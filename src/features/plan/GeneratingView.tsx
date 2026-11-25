'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { apiFetch } from '@/lib/api'
import { formatDateRange } from '@/lib/format'
import type { PlanDto, ProgressStep } from '@/lib/schema'

const PROGRESS: { id: ProgressStep; label: string }[] = [
  { id: 'offers', label: '항공권·숙소 가격을 찾고 있어요' },
  { id: 'itinerary', label: '일정을 짜고 있어요' },
  { id: 'places', label: '장소 위치를 확인하고 있어요' },
]

function Header({ plan }: { plan: PlanDto }) {
  return (
    <header>
      <Link href="/" className="-ml-1 inline-flex min-h-11 items-center px-1 text-content text-muted">
        ‹ 목록
      </Link>
      <p className="text-label font-semibold uppercase tracking-label text-muted">
        {plan.destination} · {formatDateRange(plan.startDate, plan.endDate)}
      </p>
    </header>
  )
}

export function GeneratingView({ plan, error, onRetry }: { plan: PlanDto; error?: string | null; onRetry?: () => void }) {
  const current = Math.max(0, PROGRESS.findIndex((s) => s.id === plan.progressStep))
  return (
    <main className="px-4 py-3">
      <Header plan={plan} />
      <h1 className="mt-1 text-date font-bold tracking-title text-ink">여행을 준비하고 있어요</h1>
      <ol className="mt-6 overflow-hidden rounded-card border border-hairline bg-surface">
        {PROGRESS.map((step, i) => (
          <li
            key={step.id}
            className={`flex min-h-11 items-center gap-3 px-3 py-3 text-content ${i > 0 ? 'border-t border-divider' : ''} ${
              i < current ? 'text-muted' : i === current ? 'font-semibold text-ink' : 'text-placeholder'
            }`}
          >
            <span className="w-8 shrink-0 text-label font-semibold uppercase tracking-label">
              {i < current ? '완료' : i === current ? '진행' : '대기'}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
      {error ? (
        <>
          <p role="alert" className="mt-4 text-content text-body">
            {error}
          </p>
          {onRetry && (
            <Button onClick={onRetry} className="mt-4">
              다시 시도
            </Button>
          )}
        </>
      ) : (
        <p className="mt-4 text-content text-muted">보통 1~2분 걸려요. 이 화면을 닫아도 계속 만들어져요.</p>
      )}
    </main>
  )
}

export function FailedView({ plan, onRetried }: { plan: PlanDto; onRetried: () => void }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const retry = async () => {
    setPending(true)
    setError(null)
    try {
      await apiFetch(`/api/plans/${plan.id}/retry`, { method: 'POST' })
      onRetried()
    } catch (e) {
      setError(e instanceof Error ? e.message : '다시 시도하지 못했어요.')
    } finally {
      setPending(false)
    }
  }
  return (
    <main className="px-4 py-3">
      <Header plan={plan} />
      <h1 className="mt-1 text-date font-bold tracking-title text-ink">일정을 만들지 못했어요</h1>
      <p role="alert" className="mt-3 text-content text-body">
        {error ?? plan.error ?? '알 수 없는 문제가 생겼어요.'}
      </p>
      <Button onClick={retry} disabled={pending} className="mt-6">
        {pending ? '다시 시작하는 중' : '다시 시도'}
      </Button>
    </main>
  )
}
