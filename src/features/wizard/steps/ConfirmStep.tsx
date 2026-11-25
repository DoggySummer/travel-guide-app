import { tripDates } from '@/lib/dates'
import { formatDateRange, formatKrw } from '@/lib/format'
import { parseKrw, toPlanInput } from '../draft'
import { Question, type StepProps } from '../StepFrame'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-3 py-3">
      <span className="w-20 shrink-0 text-label font-semibold uppercase tracking-label text-muted">{label}</span>
      <span className="min-w-0 flex-1 text-content text-body">{value}</span>
    </div>
  )
}

export function ConfirmStep({ draft, error }: Pick<StepProps, 'draft'> & { error: string | null }) {
  const validity = toPlanInput(draft)
  const message = error ?? (validity.ok ? null : validity.message)
  const days = tripDates(draft.startDate, draft.endDate).length
  const flight =
    draft.flightMode === 'none'
      ? '필요 없음'
      : draft.flightMode === 'booked'
        ? `예약 완료 · ${draft.bookedFlight.flightNumber} · ${formatKrw(parseKrw(draft.bookedFlight.totalKrw) ?? 0)}`
        : `가격 조회 · ${draft.departureId} → ${draft.arrivalId}`
  const stay =
    draft.stayMode === 'booked'
      ? `예약 완료 · ${draft.bookedStay.name} · ${formatKrw(parseKrw(draft.bookedStay.totalKrw) ?? 0)}`
      : `가격 조회${draft.stayArea ? ` · ${draft.stayArea}` : ''}`

  const rows: [string, string][] = [
    ['목적지', draft.destination],
    ['날짜', `${formatDateRange(draft.startDate, draft.endDate)} · ${days - 1}박 ${days}일`],
    ['인원', `${draft.origin} 출발 · 성인 ${draft.adults}${draft.children ? ` · 아동 ${draft.children}` : ''}`],
    ['동행', draft.companion ?? ''],
    ['스타일', draft.styles.join(', ')],
    ['꼭 갈 곳', draft.mustVisit.join(', ') || '없음'],
    ['강도·예산', `${draft.pace} · ${draft.budget}`],
    ['교통', draft.transport ?? ''],
    ['항공', flight],
    ['숙소', stay],
    ['추가 요청', draft.notes || '없음'],
  ]

  return (
    <>
      <Question title={'이대로\n일정을 만들까요?'} hint="만드는 데 1~2분 정도 걸려요" />
      <div className="mt-6 overflow-hidden rounded-card border border-hairline bg-surface">
        {rows.map(([label, value], i) => (
          <div key={label} className={i > 0 ? 'border-t border-divider' : undefined}>
            <Row label={label} value={value} />
          </div>
        ))}
      </div>
      {message && (
        <p role="alert" className="mt-3 text-content text-body">
          {message}
        </p>
      )}
    </>
  )
}
