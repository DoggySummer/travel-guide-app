import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('./db', () => ({
  getPlan: vi.fn(),
  updatePlan: vi.fn(),
  listMessages: vi.fn(),
  insertMessage: vi.fn(),
}))
vi.mock('./claude', () => {
  class ClaudeOutputError extends Error {}
  return { ClaudeOutputError, generateItinerary: vi.fn(), reviseItinerary: vi.fn() }
})
vi.mock('./serpapi', () => ({ fetchOffers: vi.fn() }))
vi.mock('./places', () => ({ verifyPlaces: vi.fn() }))

import { reviseItinerary } from './claude'
import { getPlan, insertMessage, listMessages, updatePlan } from './db'
import { RevisionError, runGeneration, runRevision } from './pipeline'

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('runGeneration', () => {
  test('getPlan이 실패해도 던지지 않고 failed로 기록한다', async () => {
    vi.mocked(getPlan).mockRejectedValue(new Error('supabase down'))
    vi.mocked(updatePlan).mockResolvedValue(undefined)

    await expect(runGeneration('p1')).resolves.toBeUndefined()
    expect(updatePlan).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'failed', progressStep: null }))
  })
})

describe('runRevision', () => {
  test('수정 실패 후 안내 메시지 저장도 실패하면 messages와 함께 502를 던진다', async () => {
    vi.mocked(getPlan).mockResolvedValue({
      status: 'ready',
      itinerary: { days: [] },
      offers: {},
      input: { destination: '오사카', mustVisit: [] },
    } as never)
    vi.mocked(listMessages).mockResolvedValue([])
    const userMsg = { id: 'm1', role: 'user', content: 'hi', createdAt: 'x' }
    vi.mocked(insertMessage).mockResolvedValueOnce(userMsg as never).mockRejectedValueOnce(new Error('db'))
    vi.mocked(reviseItinerary).mockRejectedValue(new Error('boom'))

    const err = await runRevision('p1', 'hi').catch((e) => e)
    expect(err).toBeInstanceOf(RevisionError)
    expect(err.status).toBe(502)
    expect(err.messages).toEqual([userMsg])
  })
})
