'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { ProgressDots } from '@/components/ProgressDots'
import { apiFetch } from '@/lib/api'
import { STEPS, canProceed, toPlanInput, type StepId } from './draft'
import type { StepProps } from './StepFrame'
import {
  CompanionStep,
  DatesStep,
  DestinationStep,
  MustVisitStep,
  NotesStep,
  PaceBudgetStep,
  PeopleStep,
  StylesStep,
  TransportStep,
} from './steps/BasicSteps'
import { FlightStep, StayStep } from './steps/BookingSteps'
import { ConfirmStep } from './steps/ConfirmStep'
import { useWizardDraft } from './useWizardDraft'

const STEP_COMPONENT: Record<Exclude<StepId, 'confirm'>, (props: StepProps) => React.ReactNode> = {
  destination: DestinationStep,
  dates: DatesStep,
  people: PeopleStep,
  companion: CompanionStep,
  styles: StylesStep,
  mustVisit: MustVisitStep,
  paceBudget: PaceBudgetStep,
  transport: TransportStep,
  flight: FlightStep,
  stay: StayStep,
  notes: NotesStep,
}

export default function Wizard() {
  const router = useRouter()
  const { step, draft, update, goTo, clear } = useWizardDraft()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const index = Math.min(step, STEPS.length - 1)
  const current = STEPS[index]
  const isLast = current.id === 'confirm'

  const back = () => (index === 0 ? router.push('/') : goTo(index - 1))

  const next = async () => {
    if (!isLast) {
      goTo(index + 1)
      return
    }
    const result = toPlanInput(draft)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { id } = await apiFetch<{ id: string }>('/api/plans', { method: 'POST', body: JSON.stringify(result.input) })
      clear()
      router.replace(`/plans/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정 만들기를 시작하지 못했어요.')
      setSubmitting(false)
    }
  }

  const StepComponent = current.id === 'confirm' ? null : STEP_COMPONENT[current.id]

  return (
    <main className="px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-2">
      <div className="flex items-center justify-between">
        <button type="button" onClick={back} aria-label="이전" className="-ml-2 flex h-11 w-11 items-center justify-center text-date text-body">
          ‹
        </button>
        <ProgressDots total={STEPS.length} current={index} />
        <span className="w-11" />
      </div>

      <p className="mt-4 text-label font-semibold uppercase tracking-label text-muted">
        {index + 1} / {STEPS.length} · {current.label}
      </p>
      <div className="mt-2">
        {StepComponent ? <StepComponent draft={draft} update={update} /> : <ConfirmStep draft={draft} error={error} />}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-[560px] bg-canvas px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <Button onClick={next} disabled={submitting || !canProceed(current.id, draft)}>
          {isLast ? (submitting ? '시작하는 중' : '일정 만들기') : '다음'}
        </Button>
      </div>
    </main>
  )
}
