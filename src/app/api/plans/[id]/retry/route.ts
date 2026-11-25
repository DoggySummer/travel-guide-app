import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { getPlan, updatePlan } from '@/server/db'
import { jsonError } from '@/server/http'
import { runGeneration } from '@/server/pipeline'

export const maxDuration = 300

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return jsonError('여행 계획을 찾지 못했어요.', 404)
  const plan = await getPlan(id)
  if (!plan) return jsonError('여행 계획을 찾지 못했어요.', 404)
  if (plan.status !== 'failed') return jsonError('실패한 계획만 다시 시도할 수 있어요.', 409)

  await updatePlan(id, { status: 'generating', progressStep: plan.offers ? 'itinerary' : 'offers', error: null })
  after(() => runGeneration(id))
  return NextResponse.json({ ok: true }, { status: 202 })
}
