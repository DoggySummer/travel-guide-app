'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { CheckRow, FieldLabel, INPUT_CLASS, Question, type StepProps } from '../StepFrame'

export function FlightStep({ draft, update }: StepProps) {
  const [guessState, setGuessState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const asked = useRef(false)
  const needsGuess = draft.flightMode === 'search' && !draft.departureId && !draft.arrivalId

  useEffect(() => {
    if (!needsGuess || asked.current) return
    asked.current = true
    const run = async () => {
      setGuessState('loading')
      try {
        const res = await apiFetch<{ departureId: string; arrivalId: string }>('/api/airports/guess', {
          method: 'POST',
          body: JSON.stringify({ origin: draft.origin, destination: draft.destination }),
        })
        update((d) => ({ departureId: d.departureId || res.departureId, arrivalId: d.arrivalId || res.arrivalId }))
        setGuessState('idle')
      } catch {
        setGuessState('failed')
      }
    }
    void run()
  }, [needsGuess, draft.origin, draft.destination, update])

  const b = draft.bookedFlight
  const setBooked = (patch: Partial<typeof b>) => update({ bookedFlight: { ...b, ...patch } })
  const code = (v: string) => v.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3)

  return (
    <>
      <Question title={'항공편은\n어떻게 할까요?'} hint="예약 전이면 실제 가격 후보를 찾아드려요" />
      <div className="mt-4">
        <CheckRow
          checked={draft.flightMode === 'booked'}
          onChange={(v) => update({ flightMode: v ? 'booked' : 'search' })}
          label="이미 예약했어요"
        />
        <CheckRow
          checked={draft.flightMode === 'none'}
          onChange={(v) => update({ flightMode: v ? 'none' : 'search' })}
          label="항공편이 필요 없어요"
        />
      </div>

      {draft.flightMode === 'search' && (
        <div className="mt-4 flex gap-3">
          <label className="flex-1">
            <FieldLabel>출발 공항</FieldLabel>
            <input value={draft.departureId} onChange={(e) => update({ departureId: code(e.target.value) })} placeholder="ICN" className={INPUT_CLASS} />
          </label>
          <label className="flex-1">
            <FieldLabel>도착 공항</FieldLabel>
            <input value={draft.arrivalId} onChange={(e) => update({ arrivalId: code(e.target.value) })} placeholder="KIX" className={INPUT_CLASS} />
          </label>
        </div>
      )}
      {draft.flightMode === 'search' && guessState === 'loading' && (
        <p className="mt-2 text-label text-muted">공항 코드를 찾고 있어요</p>
      )}
      {draft.flightMode === 'search' && guessState === 'failed' && (
        <p className="mt-2 text-label text-muted">공항 코드를 찾지 못했어요. 직접 입력해주세요.</p>
      )}

      {draft.flightMode === 'booked' && (
        <div className="mt-4 flex flex-col gap-3">
          <label>
            <FieldLabel>편명</FieldLabel>
            <input value={b.flightNumber} onChange={(e) => setBooked({ flightNumber: e.target.value })} placeholder="KE723" maxLength={20} className={INPUT_CLASS} />
          </label>
          <label>
            <FieldLabel>가는 편 도착 일시 (현지)</FieldLabel>
            <input type="datetime-local" value={b.outboundArrival} onChange={(e) => setBooked({ outboundArrival: e.target.value })} className={INPUT_CLASS} />
          </label>
          <label>
            <FieldLabel>오는 편 출발 일시 (현지)</FieldLabel>
            <input type="datetime-local" value={b.returnDeparture} onChange={(e) => setBooked({ returnDeparture: e.target.value })} className={INPUT_CLASS} />
          </label>
          <label>
            <FieldLabel>왕복 총액 (원)</FieldLabel>
            <input inputMode="numeric" value={b.totalKrw} onChange={(e) => setBooked({ totalKrw: e.target.value })} placeholder="562000" className={INPUT_CLASS} />
          </label>
        </div>
      )}
    </>
  )
}

export function StayStep({ draft, update }: StepProps) {
  const s = draft.bookedStay
  const setBooked = (patch: Partial<typeof s>) => update({ bookedStay: { ...s, ...patch } })
  return (
    <>
      <Question title={'숙소는\n어떻게 할까요?'} hint="예약 전이면 실제 가격 후보를 찾아드려요" />
      <div className="mt-4">
        <CheckRow
          checked={draft.stayMode === 'booked'}
          onChange={(v) => update({ stayMode: v ? 'booked' : 'search' })}
          label="이미 예약했어요"
        />
      </div>

      {draft.stayMode === 'search' ? (
        <label className="mt-4 block">
          <FieldLabel>선호 지역 (선택)</FieldLabel>
          <input value={draft.stayArea} onChange={(e) => update({ stayArea: e.target.value })} placeholder="예: 난바, 와이탄" maxLength={50} className={INPUT_CLASS} />
        </label>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <label>
            <FieldLabel>숙소 이름</FieldLabel>
            <input value={s.name} onChange={(e) => setBooked({ name: e.target.value })} maxLength={100} className={INPUT_CLASS} />
          </label>
          <label>
            <FieldLabel>주소 (선택)</FieldLabel>
            <input value={s.address} onChange={(e) => setBooked({ address: e.target.value })} maxLength={200} className={INPUT_CLASS} />
          </label>
          <label>
            <FieldLabel>숙박 총액 (원)</FieldLabel>
            <input inputMode="numeric" value={s.totalKrw} onChange={(e) => setBooked({ totalKrw: e.target.value })} placeholder="504000" className={INPUT_CLASS} />
          </label>
        </div>
      )}
    </>
  )
}
