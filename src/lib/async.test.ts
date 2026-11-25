import { expect, test } from 'vitest'
import { mapWithConcurrency } from './async'

test('순서를 유지하고 동시 실행 수를 지킨다', async () => {
  let running = 0
  let peak = 0
  const result = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (n) => {
    running++
    peak = Math.max(peak, running)
    await new Promise((r) => setTimeout(r, n * 5))
    running--
    return n * 10
  })
  expect(result).toEqual([50, 10, 40, 20, 30])
  expect(peak).toBe(2)
})
