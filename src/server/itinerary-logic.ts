import { tripDates } from '@/lib/dates'
import { nameMatches, normalizeName } from '@/lib/names'
import type { AiItem, AiItinerary, Day, Item, Itinerary, Offers, PlaceInfo, PlanInput } from '@/lib/schema'

export type FinalizeContext = { input: PlanInput; offers: Offers; makeId: () => string }

const REMOVE_WORDS = ['빼', '삭제', '제외', '안갈', '지워', '없애']

function normalizeTime(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return '12:00'
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return '12:00'
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

function byTime(a: { time: string }, b: { time: string }): number {
  return a.time.localeCompare(b.time)
}

function nonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

function pickFlight(ai: AiItinerary, input: PlanInput, offers: Offers): { choice: Itinerary['flight']; krw: number } {
  if (input.flight.mode === 'booked') {
    return { choice: { kind: 'booked', offerId: null, reason: '' }, krw: input.flight.totalKrw }
  }
  if (input.flight.mode === 'none') return { choice: { kind: 'none', offerId: null, reason: '' }, krw: 0 }
  if (offers.flights.length === 0) return { choice: { kind: 'unavailable', offerId: null, reason: '' }, krw: 0 }

  const chosen = offers.flights.find((f) => f.offerId === ai.flightChoice.offerId)
  const offer = chosen ?? [...offers.flights].sort((a, b) => a.priceKrw - b.priceKrw)[0]
  return {
    choice: {
      kind: 'offer',
      offerId: offer.offerId,
      reason: chosen ? ai.flightChoice.reason : '가장 저렴한 항공편으로 골랐어요.',
    },
    krw: offer.priceKrw,
  }
}

function pickStay(ai: AiItinerary, input: PlanInput, offers: Offers): { choice: Itinerary['stay']; krw: number } {
  if (input.stay.mode === 'booked') {
    return { choice: { kind: 'booked', offerId: null, reason: '' }, krw: input.stay.totalKrw }
  }
  if (offers.hotels.length === 0) return { choice: { kind: 'unavailable', offerId: null, reason: '' }, krw: 0 }

  const chosen = offers.hotels.find((h) => h.offerId === ai.stayChoice.offerId)
  const offer = chosen ?? [...offers.hotels].sort((a, b) => a.totalPriceKrw - b.totalPriceKrw)[0]
  return {
    choice: {
      kind: 'offer',
      offerId: offer.offerId,
      reason: chosen ? ai.stayChoice.reason : '가장 저렴한 숙소로 골랐어요.',
    },
    krw: offer.totalPriceKrw,
  }
}

export function finalizeItinerary(ai: AiItinerary, ctx: FinalizeContext): Itinerary {
  const { input, offers, makeId } = ctx
  const aiByDate = new Map(ai.days.map((d) => [d.date, d]))

  const toItem = (it: AiItem): Item => ({
    ...it,
    id: makeId(),
    time: normalizeTime(it.time),
    estCostKrw: nonNegative(it.estCostKrw),
    mustVisit: it.mustVisit || input.mustVisit.some((name) => nameMatches(name, it.placeName)),
  })

  const days: Day[] = tripDates(input.startDate, input.endDate).map((date) => {
    const day = aiByDate.get(date)
    return { date, theme: day?.theme || '자유 일정', items: (day?.items ?? []).map(toItem).sort(byTime) }
  })

  const allItems = days.flatMap((d) => d.items)
  const missing = input.mustVisit.filter((name) => !allItems.some((i) => nameMatches(name, i.placeName)))
  const lastDay = days[days.length - 1]
  if (lastDay && missing.length > 0) {
    for (const name of missing) {
      lastDay.items.push({
        id: makeId(),
        time: '16:00',
        placeName: name,
        category: '랜드마크',
        description: '직접 고른 장소예요. 일정에 맞춰 들러보세요.',
        estCostKrw: 0,
        mustVisit: true,
      })
    }
    lastDay.items.sort(byTime)
  }

  const flight = pickFlight(ai, input, offers)
  const stay = pickStay(ai, input, offers)
  const foodKrw = nonNegative(ai.budget.foodKrw)
  const localTransportKrw = nonNegative(ai.budget.localTransportKrw)
  const extraKrw = nonNegative(ai.budget.extraKrw)

  return {
    title: ai.title.trim().slice(0, 20) || `${input.destination} 여행`,
    summary: ai.summary,
    flight: flight.choice,
    stay: stay.choice,
    days,
    budget: {
      flightKrw: flight.krw,
      stayKrw: stay.krw,
      foodKrw,
      localTransportKrw,
      extraKrw,
      totalKrw: flight.krw + stay.krw + foodKrw + localTransportKrw + extraKrw,
      notes: ai.budget.notes,
    },
  }
}

/** "Oriental Pearl Tower (동방명주)" → ["Oriental Pearl Tower (동방명주)", "Oriental Pearl Tower", "동방명주"] */
function nameVariants(placeName: string): string[] {
  const inner = [...placeName.matchAll(/\(([^)]+)\)/g)].map((m) => m[1])
  const outer = placeName.replace(/\([^)]*\)/g, '').trim()
  return [placeName, outer, ...inner].filter(Boolean)
}

function userAskedToRemove(placeName: string, userMessage: string): boolean {
  const msg = normalizeName(userMessage)
  const mentioned = nameVariants(placeName).some((v) => msg.includes(normalizeName(v)))
  return mentioned && REMOVE_WORDS.some((w) => msg.includes(w))
}

export function protectMustVisit(prev: Itinerary, next: Itinerary, userMessage: string): Itinerary {
  const days = next.days.map((d) => ({ ...d, items: [...d.items] }))
  const nextItems = days.flatMap((d) => d.items)

  for (const prevDay of prev.days) {
    for (const item of prevDay.items) {
      if (!item.mustVisit) continue
      if (nextItems.some((i) => nameMatches(i.placeName, item.placeName))) continue
      if (userAskedToRemove(item.placeName, userMessage)) continue
      const target = days.find((d) => d.date === prevDay.date) ?? days[days.length - 1]
      if (!target) continue
      target.items.push(item)
      target.items.sort(byTime)
    }
  }
  return { ...next, days }
}

export function inheritPlaces(prev: Itinerary, next: Itinerary): Itinerary {
  const known = new Map<string, Item>()
  for (const item of prev.days.flatMap((d) => d.items)) {
    const key = normalizeName(item.placeName)
    if (!known.has(key)) known.set(key, item)
  }
  const used = new Set<string>()
  return {
    ...next,
    days: next.days.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        const match = known.get(normalizeName(item.placeName))
        if (!match || used.has(match.id)) return item
        used.add(match.id)
        return { ...item, id: match.id, place: match.place }
      }),
    })),
  }
}

export function itemsNeedingPlaces(it: Itinerary): { key: string; placeName: string }[] {
  return it.days.flatMap((d) => d.items).filter((i) => !i.place).map((i) => ({ key: i.id, placeName: i.placeName }))
}

export function applyPlaces(it: Itinerary, places: Map<string, PlaceInfo>): Itinerary {
  return {
    ...it,
    days: it.days.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        const place = places.get(item.id)
        return place ? { ...item, place } : item
      }),
    })),
  }
}
