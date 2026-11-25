import { describe, expect, test } from 'vitest'
import { tripDates } from './dates'

describe('tripDates', () => {
  test('시작일과 종료일을 포함한 날짜 목록을 만든다', () => {
    expect(tripDates('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
  })

  test('당일치기는 하루짜리 목록이다', () => {
    expect(tripDates('2026-12-18', '2026-12-18')).toEqual(['2026-12-18'])
  })

  test('종료일이 시작일보다 앞서거나 형식이 틀리면 빈 목록이다', () => {
    expect(tripDates('2026-12-18', '2026-12-17')).toEqual([])
    expect(tripDates('2026-12-18', 'nope')).toEqual([])
  })
})
