export const SESSION_COOKIE = 'tga_session'
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30

const encoder = new TextEncoder()

function toBase64Url(buf: ArrayBuffer): string {
  let bin = ''
  for (const byte of new Uint8Array(buf)) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** 토큰 형식: `<만료 unix초>.<HMAC-SHA256(만료)>` */
export async function createSessionToken(secret: string, nowMs: number = Date.now()): Promise<string> {
  const exp = String(Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SEC)
  return `${exp}.${await hmac(secret, exp)}`
}

export async function verifySessionToken(token: string, secret: string, nowMs: number = Date.now()): Promise<boolean> {
  const [exp, sig, extra] = token.split('.')
  if (!exp || !sig || extra !== undefined || !/^\d+$/.test(exp)) return false
  if (!timingSafeEqualStr(await hmac(secret, exp), sig)) return false
  return Number(exp) > nowMs / 1000
}
