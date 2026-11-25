'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { apiFetch } from '@/lib/api'
import type { PlanDetailDto } from '@/lib/schema'
import { nextPollDelay, POLL_MS } from './poll'

type State = { id: string; data: PlanDetailDto | null; error: string | null }

/** 계획을 불러오고, generating 동안 2초마다 다시 불러온다. 일시적 실패는 점점 늦춰서 몇 번 더 시도한다. */
export function usePlan(id: string) {
  const [state, setState] = useState<State>({ id, data: null, error: null })
  const [version, setVersion] = useState(0)
  const lastStatus = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    lastStatus.current = null

    const load = async () => {
      try {
        const detail = await apiFetch<PlanDetailDto>(`/api/plans/${id}`)
        if (cancelled) return
        failures = 0
        lastStatus.current = detail.plan.status
        setState({ id, data: detail, error: null })
        if (detail.plan.status === 'generating') timer = setTimeout(load, POLL_MS)
      } catch (e) {
        if (cancelled) return
        failures += 1
        const delay = lastStatus.current === null || lastStatus.current === 'generating' ? nextPollDelay(failures) : null
        if (delay !== null) {
          timer = setTimeout(load, delay)
          return
        }
        const message = e instanceof Error ? e.message : '여행 계획을 불러오지 못했어요.'
        setState((s) => ({ id, data: s.id === id ? s.data : null, error: message }))
      }
    }
    void load()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [id, version])

  // id가 바뀐 직후에는 이전 계획이 보이지 않게 걸러낸다.
  const current = state.id === id ? state : { id, data: null, error: null }

  const setData: Dispatch<SetStateAction<PlanDetailDto | null>> = useCallback(
    (action) =>
      setState((s) => {
        const base = s.id === id ? s.data : null
        return { id, error: s.id === id ? s.error : null, data: typeof action === 'function' ? action(base) : action }
      }),
    [id],
  )

  const reload = () => {
    setState((s) => (s.id === id ? { ...s, error: null } : s))
    setVersion((v) => v + 1)
  }

  return { data: current.data, error: current.error, reload, setData }
}
