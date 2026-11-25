import { tripDates } from '@/lib/dates'
import type { AiItem, AiItinerary, AiRevision, Offers, PlanInput } from '@/lib/schema'
import { toAiItinerary, type ReviseArgs } from '../prompts'

const SAMPLE: Omit<AiItem, 'mustVisit'>[] = [
  { time: '10:00', placeName: '샘플 전망대', category: '랜드마크', description: '도시 전경을 보는 곳이에요.', estCostKrw: 30000 },
  { time: '12:30', placeName: '샘플 라멘집', category: '음식점', description: '현지인이 많이 가는 라멘집이에요.', estCostKrw: 24000 },
  { time: '14:30', placeName: '샘플 시장', category: '쇼핑', description: '간식과 기념품을 사기 좋아요.', estCostKrw: 20000 },
  { time: '16:30', placeName: '샘플 공원', category: '자연', description: '산책하며 쉬어가요.', estCostKrw: 0 },
  { time: '19:00', placeName: '샘플 이자카야', category: '음식점', description: '저녁과 가벼운 술 한잔.', estCostKrw: 60000 },
]

/** MOCK_EXTERNAL=1 전용 샘플 일정. 지정 장소는 하루에 하나씩 13:30에 넣는다. */
export function mockItinerary(input: PlanInput, offers: Offers): AiItinerary {
  const must = [...input.mustVisit]
  return {
    title: `${input.destination} 샘플 여행`,
    summary: 'MOCK_EXTERNAL=1로 만든 샘플 일정이에요. 실제 AI 결과가 아니에요.',
    flightChoice: { offerId: offers.flights[0]?.offerId ?? null, reason: '샘플: 첫 번째 후보를 골랐어요.' },
    stayChoice: { offerId: offers.hotels[0]?.offerId ?? null, reason: '샘플: 첫 번째 후보를 골랐어요.' },
    days: tripDates(input.startDate, input.endDate).map((date, dayIndex) => {
      const items: AiItem[] = SAMPLE.map((s) => ({ ...s, placeName: `${s.placeName} ${dayIndex + 1}`, mustVisit: false }))
      const pick = must.shift()
      if (pick) {
        items.splice(2, 0, {
          time: '13:30',
          placeName: pick,
          category: '랜드마크',
          description: '직접 고른 장소예요.',
          estCostKrw: 0,
          mustVisit: true,
        })
      }
      return { date, theme: `${dayIndex + 1}일차 샘플 일정`, items }
    }),
    budget: { foodKrw: 300000, localTransportKrw: 80000, extraKrw: 50000, notes: '샘플 예산이에요.' },
  }
}

export function mockRevision(args: ReviseArgs): AiRevision {
  const itinerary = toAiItinerary(args.itinerary)
  itinerary.days[0]?.items.push({
    time: '21:00',
    placeName: '샘플 야경 명소',
    category: '랜드마크',
    description: `샘플 수정: "${args.message}" 요청을 받아 추가했어요.`,
    estCostKrw: 0,
    mustVisit: false,
  })
  return { reply: '샘플 응답이에요. 첫날 마지막에 야경 명소를 넣었어요.', itinerary }
}
