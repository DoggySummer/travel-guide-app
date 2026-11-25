import { z } from 'zod'
import { tripDates } from './dates'

export const CATEGORIES = ['랜드마크', '음식점', '숙소', '이동', '쇼핑', '자연'] as const
export const STYLES = ['맛집', '관광명소', '쇼핑', '자연', '휴양', '야경', '액티비티', '문화·역사'] as const
export const COMPANIONS = ['혼자', '연인', '친구', '가족'] as const
export const PACES = ['여유', '보통', '빡빡'] as const
export const BUDGETS = ['저렴', '보통', '여유'] as const
export const TRANSPORTS = ['대중교통', '렌터카', '도보 위주'] as const
export const MAX_TRIP_DAYS = 14

export const CategorySchema = z.enum(CATEGORIES)
export type Category = z.infer<typeof CategorySchema>
export type TravelStyle = (typeof STYLES)[number]
export type Companion = (typeof COMPANIONS)[number]
export type Pace = (typeof PACES)[number]
export type BudgetLevel = (typeof BUDGETS)[number]
export type Transport = (typeof TRANSPORTS)[number]

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
const iata = z.string().regex(/^[A-Z]{3}$/)
const krw = z.number().int().min(0).max(100_000_000)

// ── 위저드 입력 ─────────────────────────────────────────────

export const FlightInputSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('search'), departureId: iata, arrivalId: iata }),
  z.object({
    mode: z.literal('booked'),
    flightNumber: z.string().trim().min(2).max(20),
    outboundArrival: localDateTime,
    returnDeparture: localDateTime,
    totalKrw: krw,
  }),
  z.object({ mode: z.literal('none') }),
])
export type FlightInput = z.infer<typeof FlightInputSchema>

export const StayInputSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('search'), area: z.string().trim().max(50) }),
  z.object({
    mode: z.literal('booked'),
    name: z.string().trim().min(1).max(100),
    address: z.string().trim().max(200),
    totalKrw: krw,
  }),
])
export type StayInput = z.infer<typeof StayInputSchema>

export const PlanInputSchema = z
  .object({
    destination: z.string().trim().min(1).max(50),
    startDate: isoDate,
    endDate: isoDate,
    origin: z.string().trim().min(1).max(50),
    adults: z.number().int().min(1).max(9),
    children: z.number().int().min(0).max(8),
    companion: z.enum(COMPANIONS),
    styles: z.array(z.enum(STYLES)).min(1),
    mustVisit: z.array(z.string().trim().min(1).max(50)).max(10),
    pace: z.enum(PACES),
    budget: z.enum(BUDGETS),
    transport: z.enum(TRANSPORTS),
    flight: FlightInputSchema,
    stay: StayInputSchema,
    notes: z.string().max(500),
  })
  .superRefine((v, ctx) => {
    const days = tripDates(v.startDate, v.endDate).length
    if (days === 0) ctx.addIssue({ code: 'custom', path: ['endDate'], message: '귀국일이 출발일보다 빨라요.' })
    if (days > MAX_TRIP_DAYS)
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: `여행 기간은 최대 ${MAX_TRIP_DAYS}일이에요.` })
  })
export type PlanInput = z.infer<typeof PlanInputSchema>

// ── 가격 후보 (SerpApi 정규화 결과) ─────────────────────────

export const FlightOfferSchema = z.object({
  offerId: z.string(),
  airline: z.string(),
  flightNumbers: z.array(z.string()),
  departAirport: z.string(),
  departTime: z.string(),
  arriveAirport: z.string(),
  arriveTime: z.string(),
  durationMin: z.number(),
  stops: z.number(),
  priceKrw: z.number(),
  link: z.string(),
})
export type FlightOffer = z.infer<typeof FlightOfferSchema>

export const HotelOfferSchema = z.object({
  offerId: z.string(),
  name: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  rating: z.number().nullable(),
  totalPriceKrw: z.number(),
  link: z.string(),
})
export type HotelOffer = z.infer<typeof HotelOfferSchema>

export const OffersSchema = z.object({
  flights: z.array(FlightOfferSchema),
  hotels: z.array(HotelOfferSchema),
  flightError: z.string().nullable(),
  hotelError: z.string().nullable(),
})
export type Offers = z.infer<typeof OffersSchema>

// ── AI 출력 (구조화 출력 스키마) ─────────────────────────────
// 구조화 출력이 지원하지 않는 제약(정규식·min/max)은 넣지 않는다. 형식 확인은 서버 후처리에서 한다.

export const AiItemSchema = z.object({
  time: z.string().describe('HH:mm 24시간 형식'),
  placeName: z.string().describe('Google 지도에서 검색되는 장소 이름'),
  category: CategorySchema,
  description: z.string().describe('한두 문장 설명'),
  estCostKrw: z.number().int().describe('일행 전체 기준 원화 추정치, 무료면 0'),
  mustVisit: z.boolean().describe('사용자가 꼭 가고 싶다고 지정한 장소면 true'),
})
export type AiItem = z.infer<typeof AiItemSchema>

export const AiDaySchema = z.object({
  date: z.string().describe('YYYY-MM-DD'),
  theme: z.string().describe('그날의 한 줄 요약'),
  items: z.array(AiItemSchema),
})

const AiChoiceSchema = z.object({
  offerId: z.string().nullable().describe('offers에 있는 id. 후보가 없거나 이미 예약했으면 null'),
  reason: z.string(),
})

export const AiItinerarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  flightChoice: AiChoiceSchema,
  stayChoice: AiChoiceSchema,
  days: z.array(AiDaySchema),
  budget: z.object({
    foodKrw: z.number().int(),
    localTransportKrw: z.number().int(),
    extraKrw: z.number().int(),
    notes: z.string(),
  }),
})
export type AiItinerary = z.infer<typeof AiItinerarySchema>

export const AiRevisionSchema = z.object({
  reply: z.string().describe('무엇을 바꿨는지 사용자에게 보여줄 한두 문장'),
  itinerary: AiItinerarySchema,
})
export type AiRevision = z.infer<typeof AiRevisionSchema>

export const AirportGuessSchema = z.object({
  departureId: z.string().describe('출발 공항 IATA 코드 3글자'),
  arrivalId: z.string().describe('도착 공항 IATA 코드 3글자'),
})

// ── 저장되는 최종 일정 ───────────────────────────────────────

export const PlaceInfoSchema = z.object({
  status: z.enum(['verified', 'unverified']),
  placeId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  address: z.string().optional(),
  rating: z.number().optional(),
  mapsUrl: z.string().optional(),
})
export type PlaceInfo = z.infer<typeof PlaceInfoSchema>

export const ItemSchema = AiItemSchema.extend({
  id: z.string(),
  place: PlaceInfoSchema.optional(),
})
export type Item = z.infer<typeof ItemSchema>

export const DaySchema = AiDaySchema.extend({ items: z.array(ItemSchema) })
export type Day = z.infer<typeof DaySchema>

export const ItinerarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  flight: z.object({
    kind: z.enum(['offer', 'booked', 'none', 'unavailable']),
    offerId: z.string().nullable(),
    reason: z.string(),
  }),
  stay: z.object({
    kind: z.enum(['offer', 'booked', 'unavailable']),
    offerId: z.string().nullable(),
    reason: z.string(),
  }),
  days: z.array(DaySchema),
  budget: z.object({
    flightKrw: z.number(),
    stayKrw: z.number(),
    foodKrw: z.number(),
    localTransportKrw: z.number(),
    extraKrw: z.number(),
    totalKrw: z.number(),
    notes: z.string(),
  }),
})
export type Itinerary = z.infer<typeof ItinerarySchema>

// ── API DTO ──────────────────────────────────────────────────

export type PlanStatus = 'generating' | 'ready' | 'failed'
export type ProgressStep = 'offers' | 'itinerary' | 'places'

export type PlanDto = {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  status: PlanStatus
  progressStep: ProgressStep | null
  input: PlanInput
  offers: Offers | null
  itinerary: Itinerary | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export type PlanSummaryDto = Pick<
  PlanDto,
  'id' | 'title' | 'destination' | 'startDate' | 'endDate' | 'status' | 'createdAt'
>

export type MessageDto = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type PlanDetailDto = { plan: PlanDto; messages: MessageDto[] }
