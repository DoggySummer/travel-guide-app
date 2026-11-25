import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { MessageDto } from '@/lib/schema'
import { jsonError, readJson } from '@/server/http'
import { RevisionError, runRevision } from '@/server/pipeline'

export const maxDuration = 300

const BodySchema = z.object({ message: z.string().trim().min(1).max(500) })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return jsonError('여행 계획을 찾지 못했어요.', 404)
  const body = BodySchema.safeParse(await readJson(req))
  if (!body.success) return jsonError('수정 요청을 500자 이내로 입력해주세요.', 400)

  try {
    return NextResponse.json(await runRevision(id, body.data.message))
  } catch (e) {
    if (e instanceof RevisionError) {
      const messages = (e as RevisionError & { messages?: MessageDto[] }).messages ?? []
      return NextResponse.json({ error: e.message, messages }, { status: e.status })
    }
    console.error(e)
    return jsonError('일정을 고치는 중 문제가 생겼어요. 다시 시도해주세요.', 500)
  }
}
