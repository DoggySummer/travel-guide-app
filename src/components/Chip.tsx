import type { ButtonHTMLAttributes } from 'react'

export function Chip({
  selected,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`min-h-11 shrink-0 rounded-full px-4 text-[13px] font-semibold ${
        selected ? 'bg-ink text-canvas' : 'border border-hairline bg-surface text-body'
      } ${className}`}
      {...props}
    />
  )
}
