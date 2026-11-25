'use client'

import { useState } from 'react'
import { Sheet } from '@/components/Sheet'
import { apiFetch } from '@/lib/api'
import type { Itinerary, MessageDto } from '@/lib/schema'

type ReviseResponse = { reply: string; itinerary: Itinerary; messages: MessageDto[] }

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <p
        className={`max-w-[85%] whitespace-pre-line rounded-card px-3 py-2 text-content ${
          role === 'user' ? 'bg-ink text-canvas' : 'border border-hairline bg-canvas text-body'
        }`}
      >
        {children}
      </p>
    </div>
  )
}

export function Revise({
  planId,
  messages,
  bottomOffset,
  onRevised,
  onFailed,
}: {
  planId: string
  messages: MessageDto[]
  bottomOffset: number
  onRevised: (itinerary: Itinerary, newMessages: MessageDto[]) => void
  onFailed: () => void
}) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const message = text.trim()
    if (!message || pending) return
    setOpen(true)
    setPending(message)
    setError(null)
    setText('')
    try {
      const res = await apiFetch<ReviseResponse>(`/api/plans/${planId}/revise`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      })
      onRevised(res.itinerary, res.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : '일정을 고치지 못했어요.')
      onFailed()
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      <form
        onSubmit={send}
        style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))` }}
        className="fixed inset-x-0 z-20 mx-auto flex w-full max-w-[560px] items-center gap-2 bg-canvas px-4 py-2"
      >
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-11 shrink-0 rounded-card border border-hairline bg-surface px-3 text-label font-semibold text-body"
          >
            대화 {messages.length}
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="일정 수정 요청하기"
          enterKeyHint="send"
          disabled={pending !== null}
          className="min-h-11 min-w-0 flex-1 rounded-card border border-hairline bg-surface px-3 text-field text-ink placeholder:text-placeholder focus:border-ink focus:outline-none"
        />
        <button
          type="submit"
          aria-label="보내기"
          disabled={!text.trim() || pending !== null}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-content text-canvas disabled:opacity-30"
        >
          ↑
        </button>
      </form>

      <Sheet open={open} onClose={() => setOpen(false)} title="일정 수정">
        <div className="flex flex-col gap-2 pb-2">
          {messages.length === 0 && pending === null && (
            <p className="text-content text-muted">예: &ldquo;둘째 날이 너무 빡빡해, 두 곳만 빼줘&rdquo;</p>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role}>
              {m.content}
            </Bubble>
          ))}
          {pending !== null && (
            <>
              <Bubble role="user">{pending}</Bubble>
              <p className="text-label text-muted">일정을 고치고 있어요. 1분 정도 걸릴 수 있어요.</p>
            </>
          )}
          {error && (
            <p role="alert" className="text-content text-body">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </>
  )
}
