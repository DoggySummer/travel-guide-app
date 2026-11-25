export function formatKrw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

export function formatShortDate(iso: string): string {
  const [, m = '', d = ''] = iso.split('-')
  return `${m}.${d}`
}

export function formatDateRange(start: string, end: string): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}
