export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = (await res.json().catch(() => null)) as { error?: string } | null

  if (res.status === 401 && path !== '/api/login') {
    window.location.href = '/login'
    throw new ApiError('로그인이 필요해요.', 401)
  }
  if (!res.ok) throw new ApiError(body?.error ?? '요청을 처리하지 못했어요.', res.status)
  return body as T
}
