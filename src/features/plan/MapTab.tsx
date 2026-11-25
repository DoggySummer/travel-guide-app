'use client'

import { APIProvider, AdvancedMarker, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useMemo, useState } from 'react'
import { CategoryTag } from '@/components/CategoryTag'
import { Sheet } from '@/components/Sheet'
import { CATEGORY_PIN_COLOR, ROUTE_COLOR } from '@/lib/categories'
import { formatKrw } from '@/lib/format'
import type { Item, Itinerary } from '@/lib/schema'
import { DayChips } from './DayChips'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID'

type Stop = { item: Item; order: number; lat: number; lng: number }

function RouteLine({ stops }: { stops: Stop[] }) {
  const map = useMap()
  const maps = useMapsLibrary('maps')
  useEffect(() => {
    if (!map || !maps || stops.length < 2) return
    const line = new maps.Polyline({
      map,
      path: stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      strokeColor: ROUTE_COLOR,
      strokeOpacity: 0.7,
      strokeWeight: 2,
    })
    return () => line.setMap(null)
  }, [map, maps, stops])
  return null
}

function FitBounds({ stops }: { stops: Stop[] }) {
  const map = useMap()
  const core = useMapsLibrary('core')
  useEffect(() => {
    if (!map || !core || stops.length < 2) return
    const bounds = new core.LatLngBounds()
    for (const s of stops) bounds.extend({ lat: s.lat, lng: s.lng })
    map.fitBounds(bounds, 48)
  }, [map, core, stops])
  return null
}

export function MapTab({
  itinerary,
  dayIndex,
  onDayChange,
}: {
  itinerary: Itinerary
  dayIndex: number
  onDayChange: (i: number) => void
}) {
  const day = itinerary.days[dayIndex]
  const [selected, setSelected] = useState<Stop | null>(null)

  const stops = useMemo<Stop[]>(
    () =>
      day.items.flatMap((item, i) =>
        item.place?.status === 'verified' && item.place.lat !== undefined && item.place.lng !== undefined
          ? [{ item, order: i + 1, lat: item.place.lat, lng: item.place.lng }]
          : [],
      ),
    [day],
  )
  const hidden = day.items.length - stops.length

  const changeDay = (i: number) => {
    setSelected(null)
    onDayChange(i)
  }

  return (
    <section className="px-4">
      <DayChips days={itinerary.days} index={dayIndex} onChange={changeDay} />

      <div className="mt-3 h-[55dvh] overflow-hidden rounded-card border border-hairline bg-chip">
        {!API_KEY ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-content text-muted">
            지도 키가 설정되지 않았어요. NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 확인해주세요.
          </p>
        ) : stops.length === 0 ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-content text-muted">
            이날은 지도에 표시할 장소가 없어요.
          </p>
        ) : (
          <APIProvider apiKey={API_KEY} language="ko" region="KR">
            <Map
              key={day.date}
              mapId={MAP_ID}
              defaultCenter={{ lat: stops[0].lat, lng: stops[0].lng }}
              defaultZoom={14}
              gestureHandling="greedy"
              disableDefaultUI
              clickableIcons={false}
              className="h-full w-full"
            >
              {stops.map((stop) => (
                <AdvancedMarker
                  key={stop.item.id}
                  position={{ lat: stop.lat, lng: stop.lng }}
                  title={stop.item.placeName}
                  onClick={() => setSelected(stop)}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface text-label font-bold text-surface"
                    style={{ backgroundColor: CATEGORY_PIN_COLOR[stop.item.category] }}
                  >
                    {stop.order}
                  </span>
                </AdvancedMarker>
              ))}
              <RouteLine stops={stops} />
              <FitBounds stops={stops} />
            </Map>
          </APIProvider>
        )}
      </div>

      {hidden > 0 && (
        <p className="mt-2 text-label text-muted">위치를 확인하지 못한 장소 {hidden}곳은 지도에 표시하지 않았어요.</p>
      )}

      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={selected?.item.placeName ?? ''}>
        {selected && (
          <div className="pb-2">
            <div className="flex items-center gap-2">
              <span className="text-content font-semibold text-ink">
                {selected.order}번째 · {selected.item.time}
              </span>
              <CategoryTag category={selected.item.category} />
            </div>
            <p className="mt-2 text-content text-body">{selected.item.description}</p>
            <p className="mt-1 text-label text-muted">
              {selected.item.estCostKrw > 0 ? `예상 ${formatKrw(selected.item.estCostKrw)}` : '무료'}
              {selected.item.place?.rating ? ` · 평점 ${selected.item.place.rating.toFixed(1)}` : ''}
            </p>
            {selected.item.place?.mapsUrl && (
              <a
                href={selected.item.place.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex min-h-11 items-center text-label font-semibold text-ink underline underline-offset-4"
              >
                Google 지도에서 길찾기
              </a>
            )}
          </div>
        )}
      </Sheet>
    </section>
  )
}
