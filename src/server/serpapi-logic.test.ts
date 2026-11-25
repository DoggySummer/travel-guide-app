import { describe, expect, test } from 'vitest'
import flights from './fixtures/google-flights.json'
import hotels from './fixtures/google-hotels.json'
import { normalizeFlights, normalizeHotels } from './serpapi-logic'

describe('normalizeFlights', () => {
  test('best_flights와 other_flights를 합치고 가격 없는 항목은 뺀다', () => {
    const result = normalizeFlights(flights)
    expect(result.map((f) => f.offerId)).toEqual(['F1', 'F2', 'F3'])
    expect(result[0]).toEqual({
      offerId: 'F1',
      airline: '대한항공',
      flightNumbers: ['KE 723'],
      departAirport: 'ICN',
      departTime: '2026-12-18 09:55',
      arriveAirport: 'KIX',
      arriveTime: '2026-12-18 11:40',
      durationMin: 105,
      stops: 0,
      priceKrw: 562000,
      link: 'https://www.google.com/travel/flights?hl=ko&q=ICN-KIX',
    })
  })

  test('경유편은 첫 구간 출발과 마지막 구간 도착을 쓰고 경유 수를 센다', () => {
    const transfer = normalizeFlights(flights)[2]
    expect(transfer.flightNumbers).toEqual(['NH 862', 'NH 2177'])
    expect(transfer.arriveAirport).toBe('KIX')
    expect(transfer.stops).toBe(1)
  })

  test('limit만큼만 돌려주고, 형식이 이상한 응답은 빈 배열이다', () => {
    expect(normalizeFlights(flights, 1)).toHaveLength(1)
    expect(normalizeFlights(null)).toEqual([])
    expect(normalizeFlights({ best_flights: 'x' })).toEqual([])
  })
})

describe('normalizeHotels', () => {
  test('저렴: 가격 오름차순, 가격 없는 숙소는 빼고, 링크가 없으면 검색 링크를 쓴다', () => {
    const result = normalizeHotels(hotels, '저렴')
    expect(result.map((h) => h.name)).toEqual(['난바 비즈니스 호텔', '호텔 한큐 레스파이어 오사카', '콘래드 오사카'])
    expect(result[0].link).toBe('https://www.google.com/travel/hotels?q=osaka')
    expect(result[0].offerId).toBe('H1')
  })

  test('보통: 평점 4.0 이상 중 가격 오름차순', () => {
    expect(normalizeHotels(hotels, '보통').map((h) => h.name)).toEqual([
      '호텔 한큐 레스파이어 오사카',
      '콘래드 오사카',
    ])
  })

  test('여유: 평점 내림차순', () => {
    expect(normalizeHotels(hotels, '여유').map((h) => h.name)).toEqual([
      '콘래드 오사카',
      '호텔 한큐 레스파이어 오사카',
      '난바 비즈니스 호텔',
    ])
  })

  test('보통인데 평점 4.0 이상이 없으면 전체를 가격순으로 쓴다', () => {
    const low = { properties: [{ name: 'A', overall_rating: 3.1, total_rate: { extracted_lowest: 100 } }] }
    expect(normalizeHotels(low, '보통').map((h) => h.name)).toEqual(['A'])
  })
})
