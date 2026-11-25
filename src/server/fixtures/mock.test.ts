import { expect, test } from 'vitest'
import { AiItinerarySchema, type PlanInput } from '@/lib/schema'
import { mockItinerary } from './mock'

const input = {
  destination: '오사카',
  startDate: '2026-12-18',
  endDate: '2026-12-20',
  mustVisit: ['유니버설 스튜디오 재팬'],
} as PlanInput

test('mockItinerary는 스키마에 맞고 날짜마다 하루씩, 지정 장소를 포함한다', () => {
  const ai = mockItinerary(input, { flights: [], hotels: [], flightError: null, hotelError: null })
  expect(AiItinerarySchema.safeParse(ai).success).toBe(true)
  expect(ai.days.map((d) => d.date)).toEqual(['2026-12-18', '2026-12-19', '2026-12-20'])
  const items = ai.days.flatMap((d) => d.items)
  expect(items.some((i) => i.placeName === '유니버설 스튜디오 재팬' && i.mustVisit)).toBe(true)
})
