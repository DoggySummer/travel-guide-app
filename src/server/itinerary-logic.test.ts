import { beforeEach, describe, expect, test } from 'vitest'
import type { AiItinerary, Itinerary, Offers, PlanInput } from '@/lib/schema'
import {
  applyPlaces,
  finalizeItinerary,
  inheritPlaces,
  itemsNeedingPlaces,
  protectMustVisit,
  type FinalizeContext,
} from './itinerary-logic'

const baseInput: PlanInput = {
  destination: '상해',
  startDate: '2026-12-18',
  endDate: '2026-12-19',
  origin: '인천',
  adults: 2,
  children: 0,
  companion: '연인',
  styles: ['야경'],
  mustVisit: ['동방명주', '신천지'],
  pace: '보통',
  budget: '보통',
  transport: '대중교통',
  flight: { mode: 'search', departureId: 'ICN', arrivalId: 'PVG' },
  stay: { mode: 'search', area: '' },
  notes: '',
}

const offers: Offers = {
  flights: [
    { offerId: 'F1', airline: 'A', flightNumbers: [], departAirport: 'ICN', departTime: '', arriveAirport: 'PVG', arriveTime: '', durationMin: 0, stops: 0, priceKrw: 600000, link: '' },
    { offerId: 'F2', airline: 'B', flightNumbers: [], departAirport: 'ICN', departTime: '', arriveAirport: 'PVG', arriveTime: '', durationMin: 0, stops: 0, priceKrw: 450000, link: '' },
  ],
  hotels: [{ offerId: 'H1', name: '호텔', lat: null, lng: null, rating: 4.5, totalPriceKrw: 300000, link: '' }],
  flightError: null,
  hotelError: null,
}

function ai(overrides: Partial<AiItinerary> = {}): AiItinerary {
  return {
    title: '상해 야경 여행',
    summary: '요약',
    flightChoice: { offerId: 'F1', reason: '시간이 좋아요' },
    stayChoice: { offerId: 'H1', reason: '위치가 좋아요' },
    days: [
      {
        date: '2026-12-18',
        theme: '푸동',
        items: [
          { time: '19:00', placeName: 'Oriental Pearl Tower (동방명주)', category: '랜드마크', description: '', estCostKrw: 60000, mustVisit: false },
          { time: '9:30', placeName: '샤오롱바오 집', category: '음식점', description: '', estCostKrw: -5, mustVisit: false },
        ],
      },
      { date: '2026-12-25', theme: '여행 기간 밖', items: [] },
    ],
    budget: { foodKrw: 200000, localTransportKrw: 50000, extraKrw: 30000, notes: '' },
    ...overrides,
  }
}

let counter = 0
let ctx: FinalizeContext
beforeEach(() => {
  counter = 0
  ctx = { input: baseInput, offers, makeId: () => `id${++counter}` }
})

describe('finalizeItinerary', () => {
  test('여행 날짜에 맞춰 하루씩 만들고 기간 밖 날짜는 버린다', () => {
    const it = finalizeItinerary(ai(), ctx)
    expect(it.days.map((d) => d.date)).toEqual(['2026-12-18', '2026-12-19'])
    expect(it.days[1].theme).toBe('자유 일정')
  })

  test('시간을 HH:mm으로 맞추고 시간순으로 정렬하며 음수 비용은 0으로', () => {
    const items = finalizeItinerary(ai(), ctx).days[0].items
    expect(items.map((i) => i.time)).toEqual(['09:30', '19:00'])
    expect(items[0].estCostKrw).toBe(0)
  })

  test('지정 장소 이름과 맞는 항목은 mustVisit=true, 빠진 지정 장소는 마지막 날에 넣는다', () => {
    const it = finalizeItinerary(ai(), ctx)
    expect(it.days[0].items.find((i) => i.placeName.includes('동방명주'))?.mustVisit).toBe(true)
    const added = it.days[1].items.find((i) => i.placeName === '신천지')
    expect(added).toMatchObject({ time: '16:00', mustVisit: true, category: '랜드마크' })
  })

  test('AI가 고른 항공·숙소 금액으로 예산을 계산한다', () => {
    const it = finalizeItinerary(ai(), ctx)
    expect(it.flight).toEqual({ kind: 'offer', offerId: 'F1', reason: '시간이 좋아요' })
    expect(it.budget).toMatchObject({ flightKrw: 600000, stayKrw: 300000, totalKrw: 600000 + 300000 + 200000 + 50000 + 30000 })
  })

  test('없는 offerId를 고르면 최저가 후보로 바꾼다', () => {
    const it = finalizeItinerary(ai({ flightChoice: { offerId: 'F9', reason: 'x' } }), ctx)
    expect(it.flight).toEqual({ kind: 'offer', offerId: 'F2', reason: '가장 저렴한 항공편으로 골랐어요.' })
    expect(it.budget.flightKrw).toBe(450000)
  })

  test('예약 완료 항공·숙소는 입력한 금액을 쓴다', () => {
    const input: PlanInput = {
      ...baseInput,
      flight: { mode: 'booked', flightNumber: 'KE893', outboundArrival: '2026-12-18T11:00', returnDeparture: '2026-12-19T19:00', totalKrw: 700000 },
      stay: { mode: 'booked', name: '내 호텔', address: '', totalKrw: 250000 },
    }
    const it = finalizeItinerary(ai(), { ...ctx, input })
    expect(it.flight.kind).toBe('booked')
    expect(it.stay.kind).toBe('booked')
    expect(it.budget.flightKrw).toBe(700000)
    expect(it.budget.stayKrw).toBe(250000)
  })

  test('항공 불필요 / 후보 없음', () => {
    const none = finalizeItinerary(ai(), { ...ctx, input: { ...baseInput, flight: { mode: 'none' } } })
    expect(none.flight.kind).toBe('none')
    const empty = finalizeItinerary(ai(), { ...ctx, offers: { ...offers, flights: [], hotels: [] } })
    expect(empty.flight.kind).toBe('unavailable')
    expect(empty.stay.kind).toBe('unavailable')
    expect(empty.budget.flightKrw).toBe(0)
  })
})

describe('수정 후 처리', () => {
  function prev(): Itinerary {
    const it = finalizeItinerary(ai(), ctx)
    return applyPlaces(it, new Map(itemsNeedingPlaces(it).map((q) => [q.key, { status: 'verified' as const, lat: 1, lng: 2 }])))
  }

  // 수정 흐름에서는 finalizeItinerary가 지정 장소를 다시 채우지 않도록 mustVisit을 비운 입력을 쓴다 (runRevision과 같음)
  const reviseCtx = () => ({ ...ctx, input: { ...baseInput, mustVisit: [] } })

  test('protectMustVisit: 요청 없이 빠진 지정 장소를 원래 날짜에 되살린다', () => {
    const before = prev()
    const next = finalizeItinerary(ai({ days: [{ date: '2026-12-18', theme: '푸동', items: [] }] }), reviseCtx())
    const restored = protectMustVisit(before, next, '첫날 일정을 줄여줘')
    expect(restored.days[0].items.some((i) => i.placeName.includes('동방명주'))).toBe(true)
    expect(restored.days[1].items.some((i) => i.placeName === '신천지')).toBe(true)
  })

  const keptPearl = (mustVisit: boolean) =>
    finalizeItinerary(
      ai({
        days: [
          {
            date: '2026-12-18',
            theme: '푸동',
            items: [{ time: '19:00', placeName: 'Oriental Pearl Tower (동방명주)', category: '랜드마크', description: '', estCostKrw: 0, mustVisit }],
          },
          { date: '2026-12-19', theme: '신천지', items: [{ time: '10:00', placeName: '신천지', category: '랜드마크', description: '', estCostKrw: 0, mustVisit: true }] },
        ],
      }),
      reviseCtx(),
    )

  test('protectMustVisit: AI가 mustVisit을 false로 돌려줘도 유지된 지정 장소는 true로 되돌린다', () => {
    const result = protectMustVisit(prev(), keptPearl(false), '첫날 줄여줘')
    const pearl = result.days.flatMap((d) => d.items).find((i) => i.placeName.includes('동방명주'))!
    expect(pearl.mustVisit).toBe(true)
  })

  test('protectMustVisit: 제거 요청이 있었는데 AI가 남겼다면 AI의 값을 그대로 둔다', () => {
    const next = keptPearl(false)
    const result = protectMustVisit(prev(), next, '동방명주는 빼줘')
    const pearl = result.days.flatMap((d) => d.items).find((i) => i.placeName.includes('동방명주'))!
    expect(pearl.mustVisit).toBe(false)
    expect(next.days[0].items[0].mustVisit).toBe(false)
  })

  test('protectMustVisit: 사용자가 그 장소를 빼달라고 하면 되살리지 않는다', () => {
    const before = prev()
    const next = finalizeItinerary(ai({ days: [{ date: '2026-12-18', theme: '푸동', items: [] }] }), reviseCtx())
    const result = protectMustVisit(before, next, '동방명주는 빼줘')
    const names = result.days.flatMap((d) => d.items).map((i) => i.placeName)
    expect(names.some((n) => n.includes('동방명주'))).toBe(false)
    expect(names).toContain('신천지')
  })

  describe.each([
    ['동방명주 야경 늘리고 신천지는 빼줘', '동방명주', '신천지'],
    ['동방명주는 빼지 말아줘', '동방명주', null],
    ['일정이 빼곡해서 동방명주 시간을 줄여줘', '동방명주', null],
    ['동방명주는 빼지마, 신천지는 삭제해줘', '동방명주', '신천지'],
  ])('protectMustVisit 문장 단위 제거 판단: %s', (message, kept, removed) => {
    test('제거 요청이 걸린 장소만 되살리지 않는다', () => {
      const before = prev()
      const next = finalizeItinerary(ai({ days: [{ date: '2026-12-18', theme: '푸동', items: [] }] }), reviseCtx())
      const names = protectMustVisit(before, next, message).days.flatMap((d) => d.items).map((i) => i.placeName)
      expect(names.some((n) => n.includes(kept))).toBe(true)
      if (removed) expect(names.some((n) => n.includes(removed))).toBe(false)
      else expect(names.some((n) => n.includes('신천지'))).toBe(true)
    })
  })

  test('inheritPlaces: 같은 이름 항목은 id와 place를 물려받고, 새 항목만 확인 대상이 된다', () => {
    const before = prev()
    const pearl = before.days[0].items.find((i) => i.placeName.includes('동방명주'))!
    const next = finalizeItinerary(
      ai({
        days: [
          {
            date: '2026-12-18',
            theme: '푸동',
            items: [
              { time: '19:00', placeName: 'Oriental Pearl Tower (동방명주)', category: '랜드마크', description: '', estCostKrw: 0, mustVisit: true },
              { time: '20:30', placeName: '와이탄 야경', category: '랜드마크', description: '', estCostKrw: 0, mustVisit: false },
            ],
          },
        ],
      }),
      reviseCtx(),
    )
    const merged = inheritPlaces(before, protectMustVisit(before, next, '와이탄 야경 추가해줘'))
    const kept = merged.days[0].items.find((i) => i.placeName.includes('동방명주'))!
    expect(kept.id).toBe(pearl.id)
    expect(kept.place).toEqual(pearl.place)
    // 신천지는 되살아나면서 기존 place를 그대로 가지므로 새로 확인할 항목은 와이탄 야경뿐이다
    expect(itemsNeedingPlaces(merged).map((q) => q.placeName)).toEqual(['와이탄 야경'])
  })

  test('inheritPlaces: 같은 장소가 여러 번 나오면 각 항목이 순서대로 기존 id와 place를 물려받는다', () => {
    const before = finalizeItinerary(
      ai({
        days: [
          { date: '2026-12-18', theme: '첫날', items: [{ time: '16:00', placeName: 'Homeinn Selected', category: '숙소', description: '체크인', estCostKrw: 0, mustVisit: false }] },
          { date: '2026-12-19', theme: '둘째 날', items: [{ time: '09:00', placeName: 'Homeinn Selected', category: '숙소', description: '체크아웃', estCostKrw: 0, mustVisit: false }] },
        ],
      }),
      ctx,
    )
    const withPlaces: Itinerary = {
      ...before,
      days: before.days.map((d) => ({
        ...d,
        items: d.items.map((i) => ({ ...i, place: { status: 'verified' as const, lat: 31.23, lng: 121.48 } })),
      })),
    }
    const next = finalizeItinerary(
      ai({
        days: [
          { date: '2026-12-18', theme: '첫날', items: [{ time: '16:00', placeName: 'Homeinn Selected', category: '숙소', description: '체크인', estCostKrw: 0, mustVisit: false }] },
          { date: '2026-12-19', theme: '둘째 날', items: [{ time: '09:00', placeName: 'Homeinn Selected', category: '숙소', description: '체크아웃', estCostKrw: 0, mustVisit: false }] },
        ],
      }),
      reviseCtx(),
    )
    const merged = inheritPlaces(withPlaces, next)
    const ids = (it: Itinerary) => it.days.flatMap((d) => d.items).filter((i) => i.placeName === 'Homeinn Selected').map((i) => i.id)
    expect(ids(merged)).toEqual(ids(withPlaces))
    expect(itemsNeedingPlaces(merged)).toEqual([])
  })

  test('applyPlaces는 key(id)에 맞는 항목에만 place를 붙인다', () => {
    const it = finalizeItinerary(ai(), ctx)
    const first = it.days[0].items[0]
    const out = applyPlaces(it, new Map([[first.id, { status: 'unverified' as const }]]))
    expect(out.days[0].items[0].place).toEqual({ status: 'unverified' })
    expect(out.days[0].items[1].place).toBeUndefined()
  })
})
