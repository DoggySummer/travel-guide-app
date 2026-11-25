'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ErrorState } from '@/components/ErrorState'
import { apiFetch } from '@/lib/api'
import { formatDateRange } from '@/lib/format'
import type { PlanStatus, PlanSummaryDto } from '@/lib/schema'

const STATUS_LABEL: Record<PlanStatus, string | null> = {
  generating: '만드는 중',
  ready: null,
  failed: '실패',
}

export default function HomePage() {
  const [plans, setPlans] = useState<PlanSummaryDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    apiFetch<PlanSummaryDto[]>('/api/plans')
      .then((list) => {
        if (cancelled) return
        setPlans(list)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '목록을 불러오지 못했어요.')
      })
    return () => {
      cancelled = true
    }
  }, [version])

  return (
    <main className="px-4 pb-28 pt-5">
      <p className="text-label font-semibold uppercase tracking-label text-muted">Travel Guide</p>
      <h1 className="text-date font-bold tracking-title text-ink">내 여행</h1>

      {error ? (
        <ErrorState message={error} onRetry={() => setVersion((v) => v + 1)} />
      ) : plans === null ? (
        <p className="mt-8 text-center text-content text-muted">불러오는 중이에요</p>
      ) : plans.length === 0 ? (
        <p className="mt-8 text-center text-content text-muted">아직 만든 여행이 없어요. 아래 버튼으로 시작해보세요.</p>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-card border border-hairline bg-surface">
          {plans.map((plan, index) => (
            <li key={plan.id} className={index > 0 ? 'border-t border-divider' : undefined}>
              <Link href={`/plans/${plan.id}`} className="flex min-h-11 items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-label font-semibold uppercase tracking-label text-muted">
                    {plan.destination} · {formatDateRange(plan.startDate, plan.endDate)}
                  </p>
                  <p className="truncate text-content font-semibold text-ink">{plan.title}</p>
                </div>
                {STATUS_LABEL[plan.status] && (
                  <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-label font-semibold text-chip-fg">
                    {STATUS_LABEL[plan.status]}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[560px] bg-canvas px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <Link
          href="/new"
          className="flex min-h-12 w-full items-center justify-center rounded-card bg-ink font-semibold text-canvas"
        >
          새 여행 만들기
        </Link>
      </div>
    </main>
  )
}
