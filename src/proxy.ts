import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

const PUBLIC_PATHS = new Set(['/login', '/api/login'])

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const secret = process.env.SESSION_SECRET ?? ''
  if (token && secret && (await verifySessionToken(token, secret))) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|manifest.webmanifest|icons/).*)'],
}
