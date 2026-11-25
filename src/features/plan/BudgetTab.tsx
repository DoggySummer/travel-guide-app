'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { apiFetch } from '@/lib/api'
import { formatDuration, formatKrw } from '@/lib/format'
import type { FlightOffer, HotelOffer, Itinerary, PlanDto } from '@/lib/schema'

const LINE = [
  { key: 'flightKrw', label: '항공', tag: 'bg-cat-move-bg text-cat-move-fg', bar: 'bg-cat-move-fg' },
  { key: 'stayKrw', label: '숙박', tag: 'bg-cat-stay-bg text-cat-stay-fg', bar: 'bg-cat-stay-fg' },
  { key: 'foodKrw', label: '식비', tag: 'bg-cat-food-bg text-cat-food-fg', bar: 'bg-cat-food-fg' },
  { key: 'localTransportKrw', label: '현지 교통', tag: 'bg-cat-nature-bg text-cat-nature-fg', bar: 'bg-cat-nature-fg' },
  { key: 'extraKrw', label: '기타', tag: 'bg-chip text-chip-fg', bar: 'bg-muted' },
] as const

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-label font-semibold uppercase tracking-label text-muted">{children}</p>
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 rounded-card border border-hairline bg-surface p-3">{children}</div>
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-label font-semibold text-ink underline underline-offset-4">
      {children}
    </a>
  )
}

function FlightCard({ offer, reason }: { offer: FlightOffer; reason?: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">
          {offer.airline} {offer.flightNumbers.join(' · ')}
        </span>
        <span className="shrink-0 font-semibold text-ink">{formatKrw(offer.priceKrw)}</span>
      </div>
      <p className="text-label text-muted">
        {offer.departAirport} {offer.departTime.slice(11)} → {offer.arriveAirport} {offer.arriveTime.slice(11)} ·{' '}
        {formatDuration(offer.durationMin)} · {offer.stops === 0 ? '직항' : `경유 ${offer.stops}회`} · 왕복
      </p>
      {reason && <p className="mt-1 text-content text-body">{reason}</p>}
      <ExternalLink href={offer.link}>Google Flights에서 보기</ExternalLink>
    </>
  )
}

function HotelCard({ offer, reason }: { offer: HotelOffer; reason?: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-semibold text-ink">{offer.name}</span>
        <span className="shrink-0 font-semibold text-ink">{formatKrw(offer.totalPriceKrw)}</span>
      </div>
      <p className="text-label text-muted">{offer.rating ? `평점 ${offer.rating.toFixed(1)} · ` : ''}전체 숙박 기준</p>
      {reason && <p className="mt-1 text-content text-body">{reason}</p>}
      <ExternalLink href={offer.link}>숙소 보기</ExternalLink>
    </>
  )
}

function Others<T extends { offerId: string }>({ items, render }: { items: T[]; render: (item: T) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <>
      <Button variant="text" onClick={() => setOpen(!open)}>
        {open ? '다른 후보 접기' : `다른 후보 ${items.length}개 보기`}
      </Button>
      {open && items.map((item) => <Card key={item.offerId}>{render(item)}</Card>)}
    </>
  )
}

export function BudgetTab({ plan, itinerary }: { plan: PlanDto; itinerary: Itinerary }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const b = itinerary.budget
  const offers = plan.offers ?? { flights: [], hotels: [], flightError: null, hotelError: null }
  const input = plan.input

  const chosenFlight = offers.flights.find((f) => f.offerId === itinerary.flight.offerId)
  const chosenHotel = offers.hotels.find((h) => h.offerId === itinerary.stay.offerId)

  const remove = async () => {
    if (!window.confirm('이 여행을 삭제할까요? 되돌릴 수 없어요.')) return
    setDeleting(true)
    try {
      await apiFetch(`/api/plans/${plan.id}`, { method: 'DELETE' })
      router.replace('/')
    } catch {
      setDeleting(false)
      window.alert('삭제하지 못했어요. 다시 시도해주세요.')
    }
  }

  return (
    <section className="px-4">
      <p className="text-label font-semibold uppercase tracking-label text-muted">
        예상 총비용 · {input.adults + input.children}명
      </p>
      <p className="text-amount font-bold tracking-title text-ink">{formatKrw(b.totalKrw)}</p>

      {b.totalKrw > 0 && (
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-chip">
          {LINE.map((line) => (
            <span key={line.key} className={line.bar} style={{ width: `${(b[line.key] / b.totalKrw) * 100}%` }} />
          ))}
        </div>
      )}

      <ul className="mt-4 overflow-hidden rounded-card border border-hairline bg-surface">
        {LINE.map((line, i) => (
          <li key={line.key} className={`flex min-h-11 items-center gap-2 px-3 py-3 ${i > 0 ? 'border-t border-divider' : ''}`}>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-label font-semibold ${line.tag}`}>{line.label}</span>
            <span className="flex-1" />
            <span className="text-content font-semibold text-ink">{formatKrw(b[line.key])}</span>
          </li>
        ))}
      </ul>
      {b.notes && <p className="mt-2 text-content text-muted">{b.notes}</p>}

      {itinerary.flight.kind !== 'none' && (
        <>
          <Label>항공편</Label>
          <Card>
            {itinerary.flight.kind === 'booked' && input.flight.mode === 'booked' ? (
              <p className="text-content text-body">
                예약 완료 · {input.flight.flightNumber} · {formatKrw(input.flight.totalKrw)}
              </p>
            ) : chosenFlight ? (
              <FlightCard offer={chosenFlight} reason={itinerary.flight.reason} />
            ) : (
              <p className="text-content text-body">{offers.flightError ?? '조건에 맞는 항공권 후보가 없어요.'}</p>
            )}
          </Card>
          <Others items={offers.flights.filter((f) => f !== chosenFlight)} render={(f) => <FlightCard offer={f} />} />
        </>
      )}

      <Label>숙소</Label>
      <Card>
        {itinerary.stay.kind === 'booked' && input.stay.mode === 'booked' ? (
          <p className="text-content text-body">
            예약 완료 · {input.stay.name} · {formatKrw(input.stay.totalKrw)}
          </p>
        ) : chosenHotel ? (
          <HotelCard offer={chosenHotel} reason={itinerary.stay.reason} />
        ) : (
          <p className="text-content text-body">{offers.hotelError ?? '조건에 맞는 숙소 후보가 없어요.'}</p>
        )}
      </Card>
      <Others items={offers.hotels.filter((h) => h !== chosenHotel)} render={(h) => <HotelCard offer={h} />} />

      <p className="mt-6 text-label text-muted">가격은 조회한 시점의 시세예요. 실제 예약은 링크에서 확인해주세요.</p>
      <div className="mt-6 text-center">
        <Button variant="text" onClick={remove} disabled={deleting}>
          {deleting ? '삭제하는 중' : '이 여행 삭제'}
        </Button>
      </div>
    </section>
  )
}
