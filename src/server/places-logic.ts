import type { PlaceInfo } from '@/lib/schema'

export type LatLng = { lat: number; lng: number }

type RawPlace = {
  id?: string
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  rating?: number
  googleMapsUri?: string
}

const EARTH_RADIUS_KM = 6371

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** Places Text Search(New) 응답의 첫 결과를 PlaceInfo로. 없거나 center에서 maxKm 넘게 떨어지면 unverified. */
export function toPlaceInfo(raw: unknown, center: LatLng | null, maxKm = 100): PlaceInfo {
  const places = (raw as { places?: unknown } | null)?.places
  const first = Array.isArray(places) ? (places[0] as RawPlace | undefined) : undefined
  const lat = first?.location?.latitude
  const lng = first?.location?.longitude
  if (!first?.id || typeof lat !== 'number' || typeof lng !== 'number') return { status: 'unverified' }
  if (center && distanceKm(center, { lat, lng }) > maxKm) return { status: 'unverified' }

  const info: PlaceInfo = { status: 'verified', placeId: first.id, lat, lng }
  if (first.formattedAddress) info.address = first.formattedAddress
  if (typeof first.rating === 'number') info.rating = first.rating
  if (first.googleMapsUri) info.mapsUrl = first.googleMapsUri
  return info
}

/** MOCK_EXTERNAL용: 이름 해시로 목적지 반경 약 2km 안에 고정 좌표를 만든다. */
export function mockPlaceInfo(name: string, center: LatLng): PlaceInfo {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const dLat = ((hash & 0xffff) / 0xffff - 0.5) * 0.03
  const dLng = (((hash >>> 16) & 0xffff) / 0xffff - 0.5) * 0.03
  return {
    status: 'verified',
    placeId: `mock-${Math.abs(hash)}`,
    lat: center.lat + dLat,
    lng: center.lng + dLng,
    address: '샘플 주소',
    rating: 4.2,
    mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(name)}`,
  }
}
