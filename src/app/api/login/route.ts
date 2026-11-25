import { NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_MAX_AGE_SEC, createSessionToken, timingSafeEqualStr } from '@/lib/session'
import { env } from '@/server/env'
import { jsonError, readJson } from '@/server/http'

export async function POST(req: Request) {
  const body = (await readJson(req)) as { password?: unknown } | null
  const password = typeof body?.password === 'string' ? body.password : ''
  const { APP_PASSWORD, SESSION_SECRET } = env()

  if (!timingSafeEqualStr(password, APP_PASSWORD)) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return jsonError('비밀번호가 맞지 않아요.', 401)
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, await createSessionToken(SESSION_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  })
  return res
}
