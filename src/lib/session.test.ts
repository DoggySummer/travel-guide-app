import { describe, expect, test } from 'vitest'
import { SESSION_MAX_AGE_SEC, createSessionToken, timingSafeEqualStr, verifySessionToken } from './session'

const SECRET = 'a'.repeat(32)
const NOW = Date.parse('2026-12-01T00:00:00Z')

describe('session token', () => {
  test('만든 토큰은 같은 비밀값으로 검증된다', async () => {
    const token = await createSessionToken(SECRET, NOW)
    expect(await verifySessionToken(token, SECRET, NOW)).toBe(true)
  })

  test('다른 비밀값이면 실패한다', async () => {
    const token = await createSessionToken(SECRET, NOW)
    expect(await verifySessionToken(token, 'b'.repeat(32), NOW)).toBe(false)
  })

  test('만료 후에는 실패한다', async () => {
    const token = await createSessionToken(SECRET, NOW)
    const later = NOW + (SESSION_MAX_AGE_SEC + 1) * 1000
    expect(await verifySessionToken(token, SECRET, later)).toBe(false)
  })

  test('변조된 토큰은 실패한다', async () => {
    const token = await createSessionToken(SECRET, NOW)
    const [exp, sig] = token.split('.')
    expect(await verifySessionToken(`${Number(exp) + 999}.${sig}`, SECRET, NOW)).toBe(false)
    expect(await verifySessionToken('garbage', SECRET, NOW)).toBe(false)
  })
})

test('timingSafeEqualStr', () => {
  expect(timingSafeEqualStr('abc', 'abc')).toBe(true)
  expect(timingSafeEqualStr('abc', 'abd')).toBe(false)
  expect(timingSafeEqualStr('abc', 'abcd')).toBe(false)
})
