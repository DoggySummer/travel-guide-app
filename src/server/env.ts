import 'server-only'
import { z } from 'zod'

const EnvSchema = z.object({
  APP_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(32),
  ANTHROPIC_API_KEY: z.string().min(1),
  SERPAPI_API_KEY: z.string().min(1),
  GOOGLE_PLACES_API_KEY: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  MOCK_EXTERNAL: z.enum(['0', '1']).default('0'),
})
export type Env = z.infer<typeof EnvSchema>

let cached: Env | null = null

/** 처음 호출할 때 검증한다. 빠진 값이 있으면 이름을 담아 예외를 던진다. */
export function env(): Env {
  if (cached) return cached
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`환경변수가 올바르지 않습니다: ${names}`)
  }
  cached = result.data
  return cached
}

export function isMock(): boolean {
  return env().MOCK_EXTERNAL === '1'
}
