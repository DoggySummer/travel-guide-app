'use client'

import { useCallback, useEffect, useState } from 'react'
import { EMPTY_DRAFT, type WizardDraft } from './draft'

const KEY = 'tga:wizard'
type State = { step: number; draft: WizardDraft }

function load(): State {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>
      return { step: saved.step ?? 0, draft: { ...EMPTY_DRAFT, ...saved.draft } }
    }
  } catch {
    // 저장소를 못 쓰는 환경이면 빈 상태로 시작한다
  }
  return { step: 0, draft: EMPTY_DRAFT }
}

export function useWizardDraft() {
  const [state, setState] = useState<State>(load)

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // 저장 실패는 무시한다
    }
  }, [state])

  const update = useCallback(
    (patch: Partial<WizardDraft>) => setState((s) => ({ ...s, draft: { ...s.draft, ...patch } })),
    [],
  )
  const goTo = useCallback((step: number) => setState((s) => ({ ...s, step })), [])
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      // 무시
    }
  }, [])

  return { step: state.step, draft: state.draft, update, goTo, clear }
}
