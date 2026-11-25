import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Itinerary,
  MessageDto,
  Offers,
  PlanDto,
  PlanInput,
  PlanStatus,
  PlanSummaryDto,
  ProgressStep,
} from '@/lib/schema'
import { env } from './env'

let client: SupabaseClient | null = null

function db(): SupabaseClient {
  if (!client) {
    const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env()
    client = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

type PlanRow = {
  id: string
  title: string
  destination: string
  start_date: string
  end_date: string
  status: PlanStatus
  progress_step: ProgressStep | null
  input: PlanInput
  offers: Offers | null
  itinerary: Itinerary | null
  error: string | null
  created_at: string
  updated_at: string
}

type MessageRow = { id: string; role: 'user' | 'assistant'; content: string; created_at: string }

export type PlanPatch = Partial<{
  title: string
  status: PlanStatus
  progressStep: ProgressStep | null
  offers: Offers
  itinerary: Itinerary
  error: string | null
}>

function toPlanDto(row: PlanRow): PlanDto {
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    progressStep: row.progress_step,
    input: row.input,
    offers: row.offers,
    itinerary: row.itinerary,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toMessageDto(row: MessageRow): MessageDto {
  return { id: row.id, role: row.role, content: row.content, createdAt: row.created_at }
}

function fail(action: string, error: { message: string }): never {
  throw new Error(`DB ${action} 실패: ${error.message}`)
}

export async function insertPlan(input: PlanInput): Promise<string> {
  const { data, error } = await db()
    .from('plans')
    .insert({
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      status: 'generating',
      progress_step: 'offers',
      input,
    })
    .select('id')
    .single()
  if (error) fail('insertPlan', error)
  return (data as { id: string }).id
}

export async function getPlan(id: string): Promise<PlanDto | null> {
  const { data, error } = await db().from('plans').select('*').eq('id', id).maybeSingle()
  if (error) fail('getPlan', error)
  return data ? toPlanDto(data as PlanRow) : null
}

export async function listPlans(): Promise<PlanSummaryDto[]> {
  const { data, error } = await db()
    .from('plans')
    .select('id, title, destination, start_date, end_date, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) fail('listPlans', error)
  return (data as PlanRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
  }))
}

export async function updatePlan(id: string, patch: PlanPatch): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.title !== undefined) row.title = patch.title
  if (patch.status !== undefined) row.status = patch.status
  if (patch.progressStep !== undefined) row.progress_step = patch.progressStep
  if (patch.offers !== undefined) row.offers = patch.offers
  if (patch.itinerary !== undefined) row.itinerary = patch.itinerary
  if (patch.error !== undefined) row.error = patch.error
  const { error } = await db().from('plans').update(row).eq('id', id)
  if (error) fail('updatePlan', error)
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await db().from('plans').delete().eq('id', id)
  if (error) fail('deletePlan', error)
}

export async function listMessages(planId: string, limit = 50): Promise<MessageDto[]> {
  const { data, error } = await db()
    .from('plan_messages')
    .select('id, role, content, created_at')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) fail('listMessages', error)
  return (data as MessageRow[]).map(toMessageDto).reverse()
}

export async function insertMessage(
  planId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<MessageDto> {
  const { data, error } = await db()
    .from('plan_messages')
    .insert({ plan_id: planId, role, content })
    .select('id, role, content, created_at')
    .single()
  if (error) fail('insertMessage', error)
  return toMessageDto(data as MessageRow)
}
