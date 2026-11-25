'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/Button'
import { apiFetch } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ password }) })
      router.replace('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인하지 못했어요.')
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-4">
      <p className="text-label font-semibold uppercase tracking-label text-muted">Travel Guide</p>
      <h1 className="mt-1 text-date font-bold tracking-title text-ink">비밀번호를 입력해주세요</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="min-h-12 rounded-card border border-hairline bg-surface px-3 text-field text-ink placeholder:text-placeholder focus:border-ink focus:outline-none"
        />
        {error && (
          <p role="alert" className="text-content text-body">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending || password.length === 0}>
          {pending ? '확인 중' : '들어가기'}
        </Button>
      </form>
    </main>
  )
}
