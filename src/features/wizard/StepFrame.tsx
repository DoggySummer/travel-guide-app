import type { WizardDraft } from './draft'

export type StepProps = { draft: WizardDraft; update: (patch: Partial<WizardDraft>) => void }

export const INPUT_CLASS =
  'min-h-12 w-full rounded-card border border-hairline bg-surface px-3 text-field text-ink placeholder:text-placeholder focus:border-ink focus:outline-none'

export function Question({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h1 className="whitespace-pre-line text-date font-bold leading-snug tracking-title text-ink">{title}</h1>
      {hint && <p className="mt-1 text-content text-muted">{hint}</p>}
    </div>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-label font-semibold uppercase tracking-label text-muted">{children}</span>
}

export function Counter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  const btn = 'h-11 w-11 rounded-full border border-hairline bg-surface text-date text-body disabled:opacity-30'
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-content text-body">{label}</span>
      <div className="flex items-center gap-4">
        <button type="button" className={btn} aria-label={`${label} 줄이기`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <span className="w-6 text-center text-content font-semibold text-ink">{value}</span>
        <button type="button" className={btn} aria-label={`${label} 늘리기`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  )
}

export function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-ink"
      />
      <span className="text-content text-body">{label}</span>
    </label>
  )
}
