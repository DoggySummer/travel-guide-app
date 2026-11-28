import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('./db', () => ({
  getPlan: vi.fn(),
  updatePlan: vi.fn(),
  listMessages: vi.fn(),
  insertMessage: vi.fn(),
}))
vi.mock('./claude', () => {
  class ClaudeOutputError extends Error {}
  class ClaudeTruncatedError extends ClaudeOutputError {}
  return { ClaudeOutputError, ClaudeTruncatedError, generateItinerary: vi.fn(), reviseItinerary: vi.fn() }
})
vi.mock('./serpapi', () => ({ fetchOffers: vi.fn() }))
vi.mock('./places', () => ({ verifyPlaces: vi.fn() }))

import { ClaudeOutputError, ClaudeTruncatedError, generateItinerary, reviseItinerary } from './claude'
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

describe('runGeneration 재시도', () => {
  const plan = { offers: { flights: [], hotels: [] }, input: { destination: '오사카', mustVisit: [] } }
  beforeEach(() => {
    vi.mocked(getPlan).mockResolvedValue(plan as never)
    vi.mocked(updatePlan).mockResolvedValue(undefined)
  })

  test('max_tokens 잘림 오류는 재시도하지 않고 failed로 기록한다', async () => {
    vi.mocked(generateItinerary).mockRejectedValue(new ClaudeTruncatedError('일정이 너무 길어서 중간에 끊겼어요.'))
    await runGeneration('p1')
    expect(generateItinerary).toHaveBeenCalledTimes(1)
    expect(updatePlan).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'failed', error: '일정이 너무 길어서 중간에 끊겼어요.' }))
  })

  test('일반 ClaudeOutputError는 1회 재시도한다', async () => {
    vi.mocked(generateItinerary).mockRejectedValue(new ClaudeOutputError('형식 오류'))
    await runGeneration('p1')
    expect(generateItinerary).toHaveBeenCalledTimes(2)
    expect(updatePlan).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'failed' }))
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
