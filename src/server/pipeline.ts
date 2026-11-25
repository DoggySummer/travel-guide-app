import 'server-only'
import { randomUUID } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import type { Itinerary, MessageDto } from '@/lib/schema'
import { ClaudeOutputError, generateItinerary, reviseItinerary } from './claude'
import { getPlan, insertMessage, listMessages, updatePlan } from './db'
import { applyPlaces, finalizeItinerary, inheritPlaces, itemsNeedingPlaces, protectMustVisit } from './itinerary-logic'
import { verifyPlaces } from './places'
import { fetchOffers } from './serpapi'

/** generating 상태가 이 시간 넘게 갱신되지 않으면 멈춘 것으로 본다. */
export const STALE_MS = 10 * 60 * 1000

export class RevisionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (!(e instanceof ClaudeOutputError)) throw e
    console.warn('Claude 출력 오류, 1회 재시도:', e.message)
    return fn()
  }
}

function userMessage(e: unknown): string {
  if (e instanceof ClaudeOutputError) return e.message
  if (e instanceof Anthropic.APIError) return 'AI 서버가 응답하지 않아요. 잠시 후 다시 시도해주세요.'
  return '일정을 만드는 중 문제가 생겼어요. 다시 시도해주세요.'
}

async function attachPlaces(itinerary: Itinerary, destination: string): Promise<Itinerary> {
  const places = await verifyPlaces(itemsNeedingPlaces(itinerary), destination)
  return applyPlaces(itinerary, places)
}

export async function runGeneration(planId: string): Promise<void> {
  try {
    const plan = await getPlan(planId)
    if (!plan) return
    let offers = plan.offers
    if (!offers) {
      await updatePlan(planId, { progressStep: 'offers' })
      offers = await fetchOffers(plan.input)
      await updatePlan(planId, { offers })
    }

    await updatePlan(planId, { progressStep: 'itinerary' })
    const currentOffers = offers
    const ai = await withOneRetry(() => generateItinerary(plan.input, currentOffers))
    let itinerary = finalizeItinerary(ai, { input: plan.input, offers, makeId: randomUUID })

    await updatePlan(planId, { progressStep: 'places' })
    itinerary = await attachPlaces(itinerary, plan.input.destination)

    await updatePlan(planId, { itinerary, title: itinerary.title, status: 'ready', progressStep: null, error: null })
  } catch (e) {
    console.error('runGeneration 실패', planId, e)
    await updatePlan(planId, { status: 'failed', progressStep: null, error: userMessage(e) }).catch((dbError) =>
      console.error('실패 상태 저장도 실패', dbError),
    )
  }
}

export async function runRevision(
  planId: string,
  message: string,
): Promise<{ reply: string; itinerary: Itinerary; messages: MessageDto[] }> {
  const plan = await getPlan(planId)
  if (!plan) throw new RevisionError('여행 계획을 찾지 못했어요.', 404)
  if (plan.status !== 'ready' || !plan.itinerary || !plan.offers) {
    throw new RevisionError('일정이 완성된 뒤에 수정할 수 있어요.', 409)
  }
  const prev = plan.itinerary
  const offers = plan.offers

  const history = await listMessages(planId, 10)
  const userMsg = await insertMessage(planId, 'user', message)

  try {
    const ai = await withOneRetry(() =>
      reviseItinerary({ input: plan.input, offers, itinerary: prev, history, message }),
    )
    // 지정 장소 보충은 protectMustVisit이 맡는다. input.mustVisit을 그대로 넘기면
    // 사용자가 "빼줘"라고 한 장소를 finalizeItinerary가 다시 넣어버린다.
    const reviseInput = { ...plan.input, mustVisit: [] }
    let next = finalizeItinerary(ai.itinerary, { input: reviseInput, offers, makeId: randomUUID })
    next = protectMustVisit(prev, next, message)
    next = inheritPlaces(prev, next)
    next = await attachPlaces(next, plan.input.destination)

    await updatePlan(planId, { itinerary: next, title: next.title })
    const assistantMsg = await insertMessage(planId, 'assistant', ai.reply)
    return { reply: ai.reply, itinerary: next, messages: [userMsg, assistantMsg] }
  } catch (e) {
    console.error('runRevision 실패', planId, e)
    const text = userMessage(e).replace('일정을 만드는', '일정을 고치는')
    const messages = [userMsg]
    try {
      messages.push(await insertMessage(planId, 'assistant', text))
    } catch (insertError) {
      console.error('안내 메시지 저장 실패', planId, insertError)
    }
    throw Object.assign(new RevisionError(text, 502), { messages })
  }
}
