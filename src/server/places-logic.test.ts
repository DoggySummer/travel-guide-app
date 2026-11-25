import { describe, expect, test } from 'vitest'
import { distanceKm, mockPlaceInfo, toPlaceInfo } from './places-logic'

const SHANGHAI = { lat: 31.2304, lng: 121.4737 }

describe('distanceKm', () => {
  test('상해 시내 ↔ 푸동 공항은 약 30km', () => {
    const km = distanceKm(SHANGHAI, { lat: 31.1443, lng: 121.8083 })
    expect(km).toBeGreaterThan(28)
    expect(km).toBeLessThan(36)
  })
})

describe('toPlaceInfo', () => {
  const raw = {
    places: [
      {
        id: 'ChIJ_pearl',
        displayName: { text: '동방명주' },
        formattedAddress: '1 Century Ave, Pudong, Shanghai',
        location: { latitude: 31.2397, longitude: 121.4998 },
        rating: 4.5,
        googleMapsUri: 'https://maps.google.com/?cid=1',
      },
    ],
  }

  test('첫 결과를 verified로 변환한다', () => {
    expect(toPlaceInfo(raw, SHANGHAI)).toEqual({
      status: 'verified',
      placeId: 'ChIJ_pearl',
      lat: 31.2397,
      lng: 121.4998,
      address: '1 Century Ave, Pudong, Shanghai',
      rating: 4.5,
      mapsUrl: 'https://maps.google.com/?cid=1',
    })
  })

  test('결과가 없거나 목적지에서 너무 멀면 unverified', () => {
    expect(toPlaceInfo({ places: [] }, SHANGHAI)).toEqual({ status: 'unverified' })
    expect(toPlaceInfo({}, SHANGHAI)).toEqual({ status: 'unverified' })
    const far = { places: [{ ...raw.places[0], location: { latitude: 37.5665, longitude: 126.978 } }] }
    expect(toPlaceInfo(far, SHANGHAI)).toEqual({ status: 'unverified' })
  })

  test('목적지 좌표를 모르면 거리 확인 없이 채택한다', () => {
    expect(toPlaceInfo(raw, null).status).toBe('verified')
  })
})

test('mockPlaceInfo는 이름마다 같은 좌표를 목적지 근처에 만든다', () => {
  const a = mockPlaceInfo('동방명주', SHANGHAI)
  expect(a).toEqual(mockPlaceInfo('동방명주', SHANGHAI))
  expect(a.status).toBe('verified')
  expect(distanceKm(SHANGHAI, { lat: a.lat!, lng: a.lng! })).toBeLessThan(5)
})
