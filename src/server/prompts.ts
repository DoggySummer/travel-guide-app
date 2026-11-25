import { tripDates } from '@/lib/dates'
import type { AiItinerary, Itinerary, MessageDto, Offers, PlanInput } from '@/lib/schema'

export const GENERATE_SYSTEM = `당신은 한국인 여행자를 위한 현지 여행 가이드입니다. 주어진 조건과 가격 후보로 실제로 따라 할 수 있는 여행 일정을 만듭니다.

규칙:
- 실제로 존재하고 지금도 운영 중일 가능성이 높은 장소만 고릅니다. 지어낸 장소를 넣지 않습니다.
- placeName은 Google 지도에서 그대로 검색되는 이름으로 씁니다. 현지 공식 이름 뒤에 괄호로 한국어 이름을 붙여도 됩니다. 예: "Oriental Pearl Tower (동방명주)"
- days는 <dates>의 날짜를 순서대로 하나씩, 빠짐없이 만듭니다.
- 하루 장소 수는 일정 강도에 맞춥니다. 여유 3~4곳, 보통 5~6곳, 빡빡 7~8곳. category "이동" 항목은 장소 수에 세지 않습니다.
- 같은 날 장소는 가까운 곳끼리 묶어 동선이 되돌아가지 않게 하고, items는 time 순서로 씁니다. time은 HH:mm 24시간 형식입니다.
- 숙소가 정해져 있으면 매일 숙소에서 출발해 숙소로 돌아온다고 보고 짭니다.
- 첫날은 도착 시각 이후, 마지막 날은 출발 시각 3시간 전까지만 일정을 넣습니다. 항공 정보가 없으면 첫날 10:00부터 마지막 날 18:00까지로 봅니다.
- 점심과 저녁을 매일 넣고, 휴무일과 영업시간 상식을 고려합니다.
- <must_visit>의 장소는 반드시 넣고 mustVisit을 true로 합니다. 나머지 항목은 false입니다.
- 추가 요청(notes)과 여행 스타일을 우선 반영합니다.
- estCostKrw는 일행 전체 기준 원화 추정치이며, 무료면 0입니다.
- flightChoice와 stayChoice의 offerId는 <offers>에 있는 id 중 하나를 고르고, 후보가 없으면 null로 둡니다. reason은 고른 이유 한 문장입니다.
- budget의 foodKrw, localTransportKrw, extraKrw는 여행 전체의 일행 기준 원화 추정치입니다. 항공·숙박 금액은 넣지 않습니다. notes에는 예산 관련 팁 한두 문장을 씁니다.
- title은 20자 이내, summary는 2~3문장, theme은 한 줄로, 모두 한국어로 씁니다.`

export const REVISE_SYSTEM = `${GENERATE_SYSTEM}

수정 규칙:
- <current_itinerary>를 <request>에 맞게 고친 일정 전체를 itinerary로 돌려줍니다. 요청과 관계없는 날과 항목은 그대로 둡니다.
- mustVisit이 true인 장소는 사용자가 명시적으로 빼달라고 하지 않는 한 남깁니다.
- 다른 항공편·숙소로 바꿔달라는 요청은 <offers> 안에서만 고릅니다.
- reply에는 무엇을 바꿨는지 한두 문장으로 씁니다. 요청을 들어줄 수 없으면 그 이유를 쓰고 일정은 그대로 둡니다.`

export type ReviseArgs = {
  input: PlanInput
  offers: Offers
  itinerary: Itinerary
  history: MessageDto[]
  message: string
}

function tripFacts(input: PlanInput) {
  const flight =
    input.flight.mode === 'booked'
      ? {
          status: '예약 완료',
          flightNumber: input.flight.flightNumber,
          outboundArrival: input.flight.outboundArrival,
          returnDeparture: input.flight.returnDeparture,
        }
      : input.flight.mode === 'none'
        ? { status: '항공 필요 없음' }
        : { status: '후보 중 선택', departureId: input.flight.departureId, arrivalId: input.flight.arrivalId }
  const stay =
    input.stay.mode === 'booked'
      ? { status: '예약 완료', name: input.stay.name, address: input.stay.address }
      : { status: '후보 중 선택', preferredArea: input.stay.area || '상관없음' }

  return {
    destination: input.destination,
    origin: input.origin,
    travelers: { adults: input.adults, children: input.children },
    companion: input.companion,
    styles: input.styles,
    pace: input.pace,
    budget: input.budget,
    transport: input.transport,
    flight,
    stay,
    notes: input.notes || '(없음)',
  }
}

function offersForPrompt(offers: Offers) {
  return {
    flights: offers.flights.map((f) => ({
      id: f.offerId,
      airline: f.airline,
      flightNumbers: f.flightNumbers,
      depart: `${f.departAirport} ${f.departTime}`,
      arrive: `${f.arriveAirport} ${f.arriveTime}`,
      durationMin: f.durationMin,
      stops: f.stops,
      roundTripPriceKrw: f.priceKrw,
    })),
    hotels: offers.hotels.map((h) => ({
      id: h.offerId,
      name: h.name,
      rating: h.rating,
      totalPriceKrw: h.totalPriceKrw,
      lat: h.lat,
      lng: h.lng,
    })),
  }
}

function sharedBlocks(input: PlanInput, offers: Offers): string[] {
  return [
    `<trip>\n${JSON.stringify(tripFacts(input), null, 2)}\n</trip>`,
    `<dates>\n${tripDates(input.startDate, input.endDate).join('\n')}\n</dates>`,
    `<must_visit>\n${input.mustVisit.length > 0 ? input.mustVisit.join('\n') : '(없음)'}\n</must_visit>`,
    `<offers>\n${JSON.stringify(offersForPrompt(offers), null, 2)}\n</offers>`,
  ]
}

export function buildGenerateMessage(input: PlanInput, offers: Offers): string {
  return [...sharedBlocks(input, offers), '위 조건으로 여행 일정을 만들어주세요.'].join('\n\n')
}

export function toAiItinerary(it: Itinerary): AiItinerary {
  return {
    title: it.title,
    summary: it.summary,
    flightChoice: { offerId: it.flight.offerId, reason: it.flight.reason },
    stayChoice: { offerId: it.stay.offerId, reason: it.stay.reason },
    days: it.days.map((day) => ({
      date: day.date,
      theme: day.theme,
      items: day.items.map(({ time, placeName, category, description, estCostKrw, mustVisit }) => ({
        time,
        placeName,
        category,
        description,
        estCostKrw,
        mustVisit,
      })),
    })),
    budget: {
      foodKrw: it.budget.foodKrw,
      localTransportKrw: it.budget.localTransportKrw,
      extraKrw: it.budget.extraKrw,
      notes: it.budget.notes,
    },
  }
}

export function buildReviseMessage({ input, offers, itinerary, history, message }: ReviseArgs): string {
  const conversation =
    history.length > 0
      ? history.map((m) => `${m.role === 'user' ? '사용자' : '가이드'}: ${m.content}`).join('\n')
      : '(없음)'
  return [
    ...sharedBlocks(input, offers),
    `<current_itinerary>\n${JSON.stringify(toAiItinerary(itinerary), null, 2)}\n</current_itinerary>`,
    `<conversation>\n${conversation}\n</conversation>`,
    `<request>\n${message}\n</request>`,
  ].join('\n\n')
}
