import 'server-only'
import type { FlightOffer, HotelOffer, Offers, PlanInput } from '@/lib/schema'
import { env, isMock } from './env'
import flightsFixture from './fixtures/google-flights.json'
import hotelsFixture from './fixtures/google-hotels.json'
import { normalizeFlights, normalizeHotels } from './serpapi-logic'

const ENDPOINT = 'https://serpapi.com/search.json'

async function serpapi(params: Record<string, string>): Promise<unknown> {
  const url = new URL(ENDPOINT)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set('api_key', env().SERPAPI_API_KEY)

  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok || !body || body.error) throw new Error(`SerpApi: ${body?.error ?? `HTTP ${res.status}`}`)
  return body
}

async function searchFlights(input: PlanInput): Promise<FlightOffer[]> {
  if (input.flight.mode !== 'search') return []
  if (isMock()) return normalizeFlights(flightsFixture)
  const raw = await serpapi({
    engine: 'google_flights',
    type: '1',
    departure_id: input.flight.departureId,
    arrival_id: input.flight.arrivalId,
    outbound_date: input.startDate,
    return_date: input.endDate,
    adults: String(input.adults),
    children: String(input.children),
    currency: 'KRW',
    hl: 'ko',
    gl: 'kr',
  })
  return normalizeFlights(raw)
}

async function searchHotels(input: PlanInput): Promise<HotelOffer[]> {
  if (input.stay.mode !== 'search') return []
  if (isMock()) return normalizeHotels(hotelsFixture, input.budget)
  const params: Record<string, string> = {
    engine: 'google_hotels',
    q: [input.destination, input.stay.area, '호텔'].filter(Boolean).join(' '),
    check_in_date: input.startDate,
    check_out_date: input.endDate,
    adults: String(input.adults),
    currency: 'KRW',
    hl: 'ko',
    gl: 'kr',
  }
  if (input.children > 0) {
    params.children = String(input.children)
    params.children_ages = Array.from({ length: input.children }, () => '8').join(',')
  }
  return normalizeHotels(await serpapi(params), input.budget)
}

/** 항공·호텔을 병렬 조회한다. 실패한 쪽은 빈 배열과 안내 문구로 채우고 예외를 던지지 않는다. */
export async function fetchOffers(input: PlanInput): Promise<Offers> {
  const [flights, hotels] = await Promise.allSettled([searchFlights(input), searchHotels(input)])
  if (flights.status === 'rejected') console.error(flights.reason)
  if (hotels.status === 'rejected') console.error(hotels.reason)
  return {
    flights: flights.status === 'fulfilled' ? flights.value : [],
    hotels: hotels.status === 'fulfilled' ? hotels.value : [],
    flightError: flights.status === 'rejected' ? '항공권 가격을 가져오지 못했어요.' : null,
    hotelError: hotels.status === 'rejected' ? '숙소 가격을 가져오지 못했어요.' : null,
  }
}
