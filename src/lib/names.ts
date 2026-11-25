/** 장소 이름 비교용: 소문자, 모든 공백 제거. */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '')
}

/** 한쪽 이름이 다른 쪽에 포함되면 같은 장소로 본다. "동방명주" ↔ "Oriental Pearl Tower (동방명주)" */
export function nameMatches(a: string, b: string): boolean {
  const x = normalizeName(a)
  const y = normalizeName(b)
  if (!x || !y) return false
  return x.includes(y) || y.includes(x)
}
