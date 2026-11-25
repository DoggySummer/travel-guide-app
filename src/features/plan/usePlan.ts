'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { PlanDetailDto } from '@/lib/schema'

const POLL_MS = 2000

/** 계획을 불러오고, generating 동안 2초마다 다시 불러온다. */
export function usePlan(id: string) {
  const [data, setData] = useState<PlanDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      try {
        const detail = await apiFetch<PlanDetailDto>(`/api/plans/${id}`)
        if (cancelled) return
        setData(detail)
        setError(null)
        if (detail.plan.status === 'generating') timer = setTimeout(load, POLL_MS)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '여행 계획을 불러오지 못했어요.')
      }
    }
    void load()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [id, version])

  return { data, error, reload: () => setVersion((v) => v + 1), setData }
}
