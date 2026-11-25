import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { PlanDetailDto } from '@/lib/schema'
import { deletePlan, getPlan, listMessages, updatePlan } from '@/server/db'
import { jsonError } from '@/server/http'
import { STALE_MS } from '@/server/pipeline'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return jsonError('여행 계획을 찾지 못했어요.', 404)

  let plan = await getPlan(id)
  if (!plan) return jsonError('여행 계획을 찾지 못했어요.', 404)

  if (plan.status === 'generating' && Date.now() - Date.parse(plan.updatedAt) > STALE_MS) {
    await updatePlan(id, { status: 'failed', progressStep: null, error: '생성이 중간에 멈췄어요. 다시 시도해주세요.' })
    plan = (await getPlan(id))!
  }

  const body: PlanDetailDto = { plan, messages: await listMessages(id) }
  return NextResponse.json(body)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return jsonError('여행 계획을 찾지 못했어요.', 404)
  await deletePlan(id)
  return NextResponse.json({ ok: true })
}
