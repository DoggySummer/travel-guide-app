'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { formatDateRange } from '@/lib/format'
import { BudgetTab } from './BudgetTab'
import { FailedView, GeneratingView } from './GeneratingView'
import { MapTab } from './MapTab'
import { Revise } from './Revise'
import { ScheduleTab } from './ScheduleTab'
import { usePlan } from './usePlan'

type Tab = 'schedule' | 'map' | 'budget'
const TABS: { id: Tab; label: string }[] = [
  { id: 'schedule', label: '일정' },
  { id: 'map', label: '지도' },
  { id: 'budget', label: '예산' },
]

export const TAB_BAR_HEIGHT = 52

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav aria-label="결과 탭" className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex w-full max-w-[560px]">
        {TABS.map((t) => (
          <li key={t.id} className="flex-1">
            <button
              type="button"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => onChange(t.id)}
              style={{ minHeight: TAB_BAR_HEIGHT }}
              className={`w-full text-label font-semibold tracking-label ${tab === t.id ? 'text-ink' : 'text-muted'}`}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function PlanView({ id }: { id: string }) {
  const { data, error, reload, setData } = usePlan(id)
  const [tab, setTab] = useState<Tab>('schedule')
  const [dayIndex, setDayIndex] = useState(0)

  if (!data) {
    return (
      <main className="px-4 py-5">
        {error ? <ErrorState message={error} onRetry={reload} /> : <p className="text-content text-muted">불러오는 중이에요</p>}
      </main>
    )
  }

  const { plan } = data
  if (plan.status === 'generating') return <GeneratingView plan={plan} error={error} onRetry={reload} />
  if (plan.status === 'failed' || !plan.itinerary) return <FailedView plan={plan} onRetried={reload} />

  const itinerary = plan.itinerary
  const safeDay = Math.min(dayIndex, itinerary.days.length - 1)

  return (
    <div className="pb-[calc(160px+env(safe-area-inset-bottom))]">
      <header className="px-4 pt-2">
        <Link href="/" className="-ml-1 inline-flex min-h-11 items-center px-1 text-content text-muted">
          ‹ 목록
        </Link>
        <p className="text-label font-semibold uppercase tracking-label text-muted">
          {plan.destination} · {formatDateRange(plan.startDate, plan.endDate)}
        </p>
        <h1 className="text-date font-bold tracking-title text-ink">{itinerary.title}</h1>
      </header>

      <div className="mt-3">
        {tab === 'schedule' && <ScheduleTab itinerary={itinerary} dayIndex={safeDay} onDayChange={setDayIndex} />}
        {tab === 'map' && <MapTab itinerary={itinerary} dayIndex={safeDay} onDayChange={setDayIndex} />}
        {tab === 'budget' && <BudgetTab plan={plan} itinerary={itinerary} />}
      </div>

      {tab !== 'budget' && (
        <Revise
          planId={plan.id}
          messages={data.messages}
          bottomOffset={TAB_BAR_HEIGHT}
          onRevised={(next, newMessages) =>
            setData((d) =>
              d ? { plan: { ...d.plan, itinerary: next, title: next.title }, messages: [...d.messages, ...newMessages] } : d,
            )
          }
          onFailed={reload}
        />
      )}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
