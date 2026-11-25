import { describe, expect, test } from 'vitest'
import { PlanInputSchema, type PlanInput } from './schema'

const valid: PlanInput = {
  destination: '상해',
  startDate: '2026-12-18',
  endDate: '2026-12-21',
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
  stay: { mode: 'search', area: '' },
  notes: '',
}

describe('PlanInputSchema', () => {
  test('올바른 입력을 통과시킨다', () => {
    expect(PlanInputSchema.safeParse(valid).success).toBe(true)
  })

  test('예약 완료 항공·숙소 입력을 통과시킨다', () => {
    const booked = {
      ...valid,
      flight: {
        mode: 'booked',
        flightNumber: 'KE893',
        outboundArrival: '2026-12-18T11:40',
        returnDeparture: '2026-12-21T19:30',
        totalKrw: 562000,
      },
      stay: { mode: 'booked', name: '푸동 샹그릴라', address: '33 Fucheng Rd', totalKrw: 504000 },
    }
    expect(PlanInputSchema.safeParse(booked).success).toBe(true)
  })

  test('종료일이 시작일보다 앞서면 실패한다', () => {
    expect(PlanInputSchema.safeParse({ ...valid, endDate: '2026-12-17' }).success).toBe(false)
  })

  test('15일 이상이면 실패한다', () => {
    expect(PlanInputSchema.safeParse({ ...valid, endDate: '2027-01-01' }).success).toBe(false)
  })

  test('여행 스타일이 없거나 꼭 가고 싶은 곳이 10개를 넘으면 실패한다', () => {
    expect(PlanInputSchema.safeParse({ ...valid, styles: [] }).success).toBe(false)
    const many = Array.from({ length: 11 }, (_, i) => `장소${i}`)
    expect(PlanInputSchema.safeParse({ ...valid, mustVisit: many }).success).toBe(false)
  })

  test('공항 코드는 대문자 3글자여야 한다', () => {
    const bad = { ...valid, flight: { mode: 'search', departureId: 'icn', arrivalId: 'PVG' } }
    expect(PlanInputSchema.safeParse(bad).success).toBe(false)
  })
})
