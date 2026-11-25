const DAY_MS = 86_400_000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** 시작일~종료일(포함)의 YYYY-MM-DD 목록. 잘못된 입력이면 빈 배열. */
export function tripDates(start: string, end: string): string[] {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return []
  const s = Date.parse(`${start}T00:00:00Z`)
  const e = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return []

  const out: string[] = []
  for (let t = s; t <= e; t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}
