import 'server-only'
import { mapWithConcurrency } from '@/lib/async'
import type { PlaceInfo } from '@/lib/schema'
import { env, isMock } from './env'
import { mockPlaceInfo, toPlaceInfo, type LatLng } from './places-logic'

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.googleMapsUri'
const MOCK_CENTER: LatLng = { lat: 34.6937, lng: 135.5023 }

async function searchText(textQuery: string, center: LatLng | null): Promise<unknown> {
  const body: Record<string, unknown> = { textQuery, languageCode: 'ko' }
  if (center) {
    body.locationBias = {
      circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 50_000 },
    }
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env().GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Places: HTTP ${res.status} ${await res.text().catch(() => '')}`)
  return res.json()
}

export async function geocodeDestination(destination: string): Promise<LatLng | null> {
  if (isMock()) return MOCK_CENTER
  try {
    const info = toPlaceInfo(await searchText(destination, null), null)
    return info.status === 'verified' ? { lat: info.lat!, lng: info.lng! } : null
  } catch (e) {
    console.error(e)
    return null
  }
}

/** key별 PlaceInfo. 개별 실패는 unverified로 두고 예외를 던지지 않는다. */
export async function verifyPlaces(
  queries: { key: string; placeName: string }[],
  destination: string,
): Promise<Map<string, PlaceInfo>> {
  const result = new Map<string, PlaceInfo>()
  if (queries.length === 0) return result
  const center = await geocodeDestination(destination)

  await mapWithConcurrency(queries, 5, async ({ key, placeName }) => {
    if (isMock()) {
      result.set(key, mockPlaceInfo(placeName, center ?? MOCK_CENTER))
      return
    }
    try {
      result.set(key, toPlaceInfo(await searchText(`${placeName} ${destination}`, center), center))
    } catch (e) {
      console.error(e)
      result.set(key, { status: 'unverified' })
    }
  })
  return result
}
