'use client'

import { useEffect } from 'react'

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/30" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[80dvh] w-full max-w-[560px] overflow-y-auto rounded-t-sheet border-t border-hairline bg-surface px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-content font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 h-11 w-11 text-date text-muted">
            ×
          </button>
        </div>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  )
}
