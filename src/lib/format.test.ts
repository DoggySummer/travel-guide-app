import { expect, test } from 'vitest'
import { formatDateRange, formatDuration, formatKrw, formatShortDate } from './format'

test('formatKrw', () => {
  expect(formatKrw(1482000)).toBe('1,482,000원')
  expect(formatKrw(0)).toBe('0원')
})

test('formatShortDate / formatDateRange', () => {
  expect(formatShortDate('2026-12-08')).toBe('12.08')
  expect(formatDateRange('2026-12-18', '2026-12-21')).toBe('12.18 – 12.21')
})

test('formatDuration', () => {
  expect(formatDuration(105)).toBe('1시간 45분')
  expect(formatDuration(120)).toBe('2시간')
  expect(formatDuration(40)).toBe('40분')
})
