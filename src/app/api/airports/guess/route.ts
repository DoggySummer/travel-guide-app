import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ClaudeOutputError, guessAirports } from '@/server/claude'
import { jsonError, readJson } from '@/server/http'

const BodySchema = z.object({
  origin: z.string().trim().min(1).max(50),
  destination: z.string().trim().min(1).max(50),
})

export async function POST(req: Request) {
  const body = BodySchema.safeParse(await readJson(req))
  if (!body.success) return jsonError('출발지와 목적지를 입력해주세요.', 400)
  try {
    return NextResponse.json(await guessAirports(body.data.origin, body.data.destination))
  } catch (e) {
    if (e instanceof ClaudeOutputError) return jsonError(e.message, 422)
    console.error(e)
    return jsonError('공항 코드를 추정하지 못했어요. 직접 입력해주세요.', 502)
  }
}
