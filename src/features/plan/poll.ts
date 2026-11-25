export const POLL_MS = 2000
const MAX_DELAY_MS = 10000
const MAX_FAILURES = 5

/** 연속 실패 횟수(1부터)에 따른 다음 재시도 대기(ms). 한도를 넘으면 null. */
export function nextPollDelay(consecutiveFailures: number): number | null {
  if (consecutiveFailures >= MAX_FAILURES) return null
  return Math.min(POLL_MS * 2 ** (consecutiveFailures - 1), MAX_DELAY_MS)
}
