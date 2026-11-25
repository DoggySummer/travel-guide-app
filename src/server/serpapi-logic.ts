import type { BudgetLevel, FlightOffer, HotelOffer } from '@/lib/schema'

type RawLeg = {
  departure_airport?: { id?: string; time?: string }
  arrival_airport?: { id?: string; time?: string }
  airline?: string
  flight_number?: string
}
type RawFlightOption = { flights?: RawLeg[]; total_duration?: number; price?: number }
type RawProperty = {
  name?: string
  gps_coordinates?: { latitude?: number; longitude?: number }
  overall_rating?: number
  total_rate?: { extracted_lowest?: number }
  link?: string
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export function normalizeFlights(raw: unknown, limit = 5): FlightOffer[] {
  const body = asRecord(raw)
  const meta = asRecord(body.search_metadata)
  const link =
    typeof meta.google_flights_url === 'string' ? meta.google_flights_url : 'https://www.google.com/travel/flights'
  const options = [...asArray<RawFlightOption>(body.best_flights), ...asArray<RawFlightOption>(body.other_flights)]

  return options
    .filter((o) => typeof o.price === 'number' && Array.isArray(o.flights) && o.flights.length > 0)
    .slice(0, limit)
    .map((o, index) => {
      const legs = o.flights as RawLeg[]
      const first = legs[0]
      const last = legs[legs.length - 1]
      return {
        offerId: `F${index + 1}`,
        airline: first.airline ?? '항공사 정보 없음',
        flightNumbers: legs.map((leg) => leg.flight_number ?? '').filter(Boolean),
        departAirport: first.departure_airport?.id ?? '',
        departTime: first.departure_airport?.time ?? '',
        arriveAirport: last.arrival_airport?.id ?? '',
        arriveTime: last.arrival_airport?.time ?? '',
        durationMin: o.total_duration ?? 0,
        stops: legs.length - 1,
        priceKrw: Math.round(o.price as number),
        link,
      }
    })
}

type HotelDraft = Omit<HotelOffer, 'offerId'>

function sortHotels(list: HotelDraft[], budget: BudgetLevel): HotelDraft[] {
  const byPrice = (a: HotelDraft, b: HotelDraft) => a.totalPriceKrw - b.totalPriceKrw
  if (budget === '저렴') return [...list].sort(byPrice)
  if (budget === '보통') {
    const good = list.filter((h) => (h.rating ?? 0) >= 4)
    return [...(good.length > 0 ? good : list)].sort(byPrice)
  }
  return [...list].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byPrice(a, b))
}

export function normalizeHotels(raw: unknown, budget: BudgetLevel, limit = 8): HotelOffer[] {
  const body = asRecord(raw)
  const meta = asRecord(body.search_metadata)
  const fallbackLink =
    typeof meta.google_hotels_url === 'string' ? meta.google_hotels_url : 'https://www.google.com/travel/hotels'

  const drafts: HotelDraft[] = asArray<RawProperty>(body.properties)
    .filter((p) => typeof p.name === 'string' && typeof p.total_rate?.extracted_lowest === 'number')
    .map((p) => ({
      name: p.name as string,
      lat: p.gps_coordinates?.latitude ?? null,
      lng: p.gps_coordinates?.longitude ?? null,
      rating: p.overall_rating ?? null,
      totalPriceKrw: Math.round(p.total_rate?.extracted_lowest as number),
      link: p.link ?? fallbackLink,
    }))

  return sortHotels(drafts, budget)
    .slice(0, limit)
    .map((h, index) => ({ offerId: `H${index + 1}`, ...h }))
}
