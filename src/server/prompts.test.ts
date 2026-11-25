import { describe, expect, test } from 'vitest'
import type { Itinerary, Offers, PlanInput } from '@/lib/schema'
import { buildGenerateMessage, buildReviseMessage, toAiItinerary } from './prompts'

const input: PlanInput = {
  destination: '상해',
  startDate: '2026-12-18',
  endDate: '2026-12-20',
  origin: '인천',
  adults: 2,
  children: 0,
  companion: '연인',
  styles: ['맛집', '야경'],
  mustVisit: ['동방명주', '신천지'],
  pace: '보통',
  budget: '보통',
  transport: '대중교통',
  flight: { mode: 'search', departureId: 'ICN', arrivalId: 'PVG' },
  stay: { mode: 'search', area: '와이탄' },
  notes: '해산물 못 먹어요',
}

const offers: Offers = {
  flights: [
    {
      offerId: 'F1',
      airline: '대한항공',
      flightNumbers: ['KE 893'],
      departAirport: 'ICN',
      departTime: '2026-12-18 09:00',
      arriveAirport: 'PVG',
      arriveTime: '2026-12-18 10:10',
      durationMin: 130,
      stops: 0,
      priceKrw: 520000,
      link: 'https://x',
    },
  ],
  hotels: [],
  flightError: null,
  hotelError: '숙소 가격을 가져오지 못했어요.',
}

describe('buildGenerateMessage', () => {
  const text = buildGenerateMessage(input, offers)

  test('여행 날짜를 빠짐없이 넣는다', () => {
    expect(text).toContain('<dates>\n2026-12-18\n2026-12-19\n2026-12-20\n</dates>')
  })

  test('꼭 가고 싶은 곳과 추가 요청을 넣는다', () => {
    expect(text).toContain('<must_visit>\n동방명주\n신천지\n</must_visit>')
    expect(text).toContain('해산물 못 먹어요')
  })

  test('항공 후보 id를 넣고, 가격 링크는 넣지 않는다', () => {
    expect(text).toContain('"id": "F1"')
    expect(text).not.toContain('https://x')
  })

  test('예약 완료 항공은 편명과 시각을 넣는다', () => {
    const booked = buildGenerateMessage(
      {
        ...input,
        flight: {
          mode: 'booked',
          flightNumber: 'OZ361',
          outboundArrival: '2026-12-18T11:40',
          returnDeparture: '2026-12-20T19:30',
          totalKrw: 600000,
        },
      },
      { ...offers, flights: [] },
    )
    expect(booked).toContain('OZ361')
    expect(booked).toContain('2026-12-18T11:40')
    expect(booked).toContain('"flights": []')
  })
})

describe('buildReviseMessage / toAiItinerary', () => {
  const itinerary: Itinerary = {
    title: '상해 야경 여행',
    summary: '요약',
    flight: { kind: 'offer', offerId: 'F1', reason: '직항' },
    stay: { kind: 'unavailable', offerId: null, reason: '' },
    days: [
      {
        date: '2026-12-18',
        theme: '푸동',
        items: [
          {
            id: 'i1',
            time: '18:00',
            placeName: '동방명주',
            category: '랜드마크',
            description: '야경',
            estCostKrw: 60000,
            mustVisit: true,
            place: { status: 'verified', placeId: 'p1', lat: 1, lng: 2 },
          },
        ],
      },
    ],
    budget: { flightKrw: 520000, stayKrw: 0, foodKrw: 1, localTransportKrw: 2, extraKrw: 3, totalKrw: 520006, notes: '' },
  }

  test('toAiItinerary는 서버 전용 필드(id, place, 항공·숙박 금액)를 뺀다', () => {
    const ai = toAiItinerary(itinerary)
    expect(ai.days[0].items[0]).toEqual({
      time: '18:00',
      placeName: '동방명주',
      category: '랜드마크',
      description: '야경',
      estCostKrw: 60000,
      mustVisit: true,
    })
    expect(ai.flightChoice).toEqual({ offerId: 'F1', reason: '직항' })
    expect(ai.budget).toEqual({ foodKrw: 1, localTransportKrw: 2, extraKrw: 3, notes: '' })
  })

  test('현재 일정, 대화, 요청을 넣는다', () => {
    const text = buildReviseMessage({
      input,
      offers,
      itinerary,
      history: [{ id: 'm1', role: 'user', content: '첫날 줄여줘', createdAt: '' }],
      message: '둘째 날 라멘집 추가해줘',
    })
    expect(text).toContain('<current_itinerary>')
    expect(text).not.toContain('"placeId"')
    expect(text).toContain('사용자: 첫날 줄여줘')
    expect(text).toContain('<request>\n둘째 날 라멘집 추가해줘\n</request>')
  })
})
