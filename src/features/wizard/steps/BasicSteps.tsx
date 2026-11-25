'use client'

import { useState } from 'react'
import { Chip } from '@/components/Chip'
import { tripDates } from '@/lib/dates'
import { BUDGETS, COMPANIONS, MAX_TRIP_DAYS, PACES, STYLES, TRANSPORTS } from '@/lib/schema'
import { Counter, FieldLabel, INPUT_CLASS, Question, type StepProps } from '../StepFrame'

export function DestinationStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'어디로\n여행을 가나요?'} hint="도시나 국가 이름을 적어주세요" />
      <input
        autoFocus
        value={draft.destination}
        onChange={(e) => update({ destination: e.target.value })}
        placeholder="예: 오사카, 상해, 제주도"
        maxLength={50}
        className={`mt-6 ${INPUT_CLASS}`}
      />
    </>
  )
}

export function DatesStep({ draft, update }: StepProps) {
  const days = tripDates(draft.startDate, draft.endDate).length
  const tooLong = days > MAX_TRIP_DAYS
  return (
    <>
      <Question title={'언제\n떠나나요?'} hint={`최대 ${MAX_TRIP_DAYS}일까지 짤 수 있어요`} />
      <div className="mt-6 flex flex-col gap-3">
        <label>
          <FieldLabel>출발일</FieldLabel>
          <input type="date" value={draft.startDate} onChange={(e) => update({ startDate: e.target.value })} className={INPUT_CLASS} />
        </label>
        <label>
          <FieldLabel>귀국일</FieldLabel>
          <input
            type="date"
            value={draft.endDate}
            min={draft.startDate || undefined}
            onChange={(e) => update({ endDate: e.target.value })}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      {days > 0 && (
        <p className={`mt-3 text-content ${tooLong ? 'text-body' : 'text-muted'}`}>
          {tooLong ? `${MAX_TRIP_DAYS}일을 넘었어요. 귀국일을 당겨주세요.` : `${days - 1}박 ${days}일`}
        </p>
      )}
    </>
  )
}

export function PeopleStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'어디서 출발하고\n몇 명이 가나요?'} />
      <label className="mt-6 block">
        <FieldLabel>출발지</FieldLabel>
        <input value={draft.origin} onChange={(e) => update({ origin: e.target.value })} maxLength={50} className={INPUT_CLASS} />
      </label>
      <div className="mt-4 rounded-card border border-hairline bg-surface px-3">
        <Counter label="성인" value={draft.adults} min={1} max={9} onChange={(adults) => update({ adults })} />
        <div className="border-t border-divider" />
        <Counter label="아동" value={draft.children} min={0} max={8} onChange={(children) => update({ children })} />
      </div>
    </>
  )
}

export function CompanionStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'누구와\n함께 가나요?'} />
      <div className="mt-6 flex flex-wrap gap-2">
        {COMPANIONS.map((c) => (
          <Chip key={c} selected={draft.companion === c} onClick={() => update({ companion: c })}>
            {c}
          </Chip>
        ))}
      </div>
    </>
  )
}

export function StylesStep({ draft, update }: StepProps) {
  const toggle = (s: (typeof STYLES)[number]) =>
    update({ styles: draft.styles.includes(s) ? draft.styles.filter((x) => x !== s) : [...draft.styles, s] })
  return (
    <>
      <Question title={'이번 여행에서\n무엇을 하고 싶나요?'} hint="여러 개 고를 수 있어요" />
      <div className="mt-6 flex flex-wrap gap-2">
        {STYLES.map((s) => (
          <Chip key={s} selected={draft.styles.includes(s)} onClick={() => toggle(s)}>
            {s}
          </Chip>
        ))}
      </div>
    </>
  )
}

export function MustVisitStep({ draft, update }: StepProps) {
  const [text, setText] = useState('')
  const add = () => {
    const name = text.trim()
    if (!name || draft.mustVisit.includes(name) || draft.mustVisit.length >= 10) return
    update({ mustVisit: [...draft.mustVisit, name] })
    setText('')
  }
  return (
    <>
      <Question title={'꼭 가고 싶은 곳이\n있나요?'} hint="적어두면 일정에 반드시 넣어요. 없으면 다음으로 넘어가세요" />
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 동방명주"
          maxLength={50}
          enterKeyHint="done"
          className={INPUT_CLASS}
        />
        <button type="submit" className="min-h-12 shrink-0 rounded-card border border-hairline bg-surface px-4 font-semibold text-body">
          추가
        </button>
      </form>
      {draft.mustVisit.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {draft.mustVisit.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => update({ mustVisit: draft.mustVisit.filter((n) => n !== name) })}
              aria-label={`${name} 빼기`}
              className="flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-canvas"
            >
              {name}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-label text-muted">{draft.mustVisit.length} / 10</p>
    </>
  )
}

export function PaceBudgetStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'일정 강도와\n예산을 골라주세요'} />
      <div className="mt-6">
        <FieldLabel>일정 강도</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {PACES.map((p) => (
            <Chip key={p} selected={draft.pace === p} onClick={() => update({ pace: p })}>
              {p}
            </Chip>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <FieldLabel>예산</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {BUDGETS.map((b) => (
            <Chip key={b} selected={draft.budget === b} onClick={() => update({ budget: b })}>
              {b}
            </Chip>
          ))}
        </div>
      </div>
    </>
  )
}

export function TransportStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'현지에서는\n어떻게 다니나요?'} />
      <div className="mt-6 flex flex-wrap gap-2">
        {TRANSPORTS.map((t) => (
          <Chip key={t} selected={draft.transport === t} onClick={() => update({ transport: t })}>
            {t}
          </Chip>
        ))}
      </div>
    </>
  )
}

export function NotesStep({ draft, update }: StepProps) {
  return (
    <>
      <Question title={'더 바라는 점이\n있나요?'} hint="없으면 비워두세요" />
      <textarea
        value={draft.notes}
        onChange={(e) => update({ notes: e.target.value })}
        maxLength={500}
        rows={5}
        placeholder={'예: 둘째 날 저녁은 야경을 보고 싶어요.\n해산물은 못 먹어요.'}
        className={`mt-6 py-3 ${INPUT_CLASS}`}
      />
      <p className="mt-1 text-right text-label text-muted">{draft.notes.length} / 500</p>
    </>
  )
}
