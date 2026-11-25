import { describe, expect, it } from 'vitest'
import { nextPollDelay } from './poll'

describe('nextPollDelay', () => {
  it('backs off 2s, 4s, 8s and caps at 10s', () => {
    expect([1, 2, 3, 4].map(nextPollDelay)).toEqual([2000, 4000, 8000, 10000])
  })
  it('gives up after the cap', () => {
    expect(nextPollDelay(5)).toBeNull()
    expect(nextPollDelay(9)).toBeNull()
  })
})
