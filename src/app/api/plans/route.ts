import { NextResponse, after } from 'next/server'
import { PlanInputSchema } from '@/lib/schema'
import { insertPlan, listPlans } from '@/server/db'
import { jsonError, readJson } from '@/server/http'
import { runGeneration } from '@/server/pipeline'

export const maxDuration = 300

export async function GET() {
  return NextResponse.json(await listPlans())
}

export async function POST(req: Request) {
  const parsed = PlanInputSchema.safeParse(await readJson(req))
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? '입력을 다시 확인해주세요.', 400)
  }
  const id = await insertPlan(parsed.data)
  after(() => runGeneration(id))
  return NextResponse.json({ id }, { status: 201 })
}
