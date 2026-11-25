'use client'

import { useState } from 'react'
import { CategoryTag } from '@/components/CategoryTag'
import { formatKrw } from '@/lib/format'
import type { Item, Itinerary } from '@/lib/schema'
import { DayChips } from './DayChips'

function ItemDetail({ item }: { item: Item }) {
  const meta = [
    item.estCostKrw > 0 ? `예상 ${formatKrw(item.estCostKrw)}` : '무료',
    item.place?.rating ? `평점 ${item.place.rating.toFixed(1)}` : null,
    item.place?.status === 'unverified' ? '위치 미확인' : null,
  ].filter(Boolean)
  return (
    <div className="pb-3 pl-[60px] pr-3">
      <p className="text-content text-body">{item.description}</p>
      <p className="mt-1 text-label text-muted">{meta.join(' · ')}</p>
      {item.place?.address && <p className="text-label text-muted">{item.place.address}</p>}
      {item.place?.mapsUrl && (
        <a
          href={item.place.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex min-h-11 items-center text-label font-semibold text-ink underline underline-offset-4"
        >
          Google 지도에서 보기
        </a>
      )}
    </div>
  )
}

export function ScheduleTab({
  itinerary,
  dayIndex,
  onDayChange,
}: {
  itinerary: Itinerary
  dayIndex: number
  onDayChange: (i: number) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const day = itinerary.days[dayIndex]

  return (
    <section className="px-4">
      <p className="text-content text-body">{itinerary.summary}</p>
      <div className="mt-4">
        <DayChips days={itinerary.days} index={dayIndex} onChange={onDayChange} />
      </div>
      <p className="mt-3 text-content font-semibold text-ink">{day.theme}</p>

      {day.items.length === 0 ? (
        <p className="mt-6 text-center text-content text-muted">이날은 자유 일정이에요.</p>
      ) : (
        <ul className="mt-2 overflow-hidden rounded-card border border-hairline bg-surface">
          {day.items.map((item, i) => {
            const open = openId === item.id
            return (
              <li key={item.id} className={i > 0 ? 'border-t border-divider' : undefined}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex min-h-11 w-full items-center gap-2 px-3 py-3 text-left"
                >
                  <span className="w-11 shrink-0 text-content font-semibold text-ink">{item.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-content text-body">{item.placeName}</span>
                    {item.mustVisit && <span className="block text-label font-semibold text-muted">내가 고른 곳</span>}
                  </span>
                  <CategoryTag category={item.category} />
                </button>
                {open && <ItemDetail item={item} />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
