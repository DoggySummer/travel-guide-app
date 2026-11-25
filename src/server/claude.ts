import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import {
  AiItinerarySchema,
  AiRevisionSchema,
  AirportGuessSchema,
  type AiItinerary,
  type AiRevision,
  type Offers,
  type PlanInput,
} from '@/lib/schema'
import { env, isMock } from './env'
import { mockItinerary, mockRevision } from './fixtures/mock'
import { GENERATE_SYSTEM, REVISE_SYSTEM, buildGenerateMessage, buildReviseMessage, type ReviseArgs } from './prompts'

const PLAN_MODEL = 'claude-opus-5-5'
const LIGHT_MODEL = 'claude-haiku-5-5'
const IATA = /^[A-Z]{3}$/

/** 응답이 거절·잘림·형식 오류일 때. 파이프라인이 1회 재시도한다. */
export class ClaudeOutputError extends Error {}

let client: Anthropic | null = null
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, maxRetries: 3 })
  return client
}

function checkStop(stopReason: string | null): void {
  if (stopReason === 'refusal') {
    throw new ClaudeOutputError('AI가 이 요청을 처리하지 않았어요. 요청 내용을 바꿔서 다시 시도해주세요.')
  }
  if (stopReason === 'max_tokens') {
    throw new ClaudeOutputError('일정이 너무 길어서 중간에 끊겼어요. 다시 시도해주세요.')
  }
}

export async function generateItinerary(input: PlanInput, offers: Offers): Promise<AiItinerary> {
  if (isMock()) return mockItinerary(input, offers)
  const response = await anthropic().messages.parse({
    model: PLAN_MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(AiItinerarySchema) },
    system: GENERATE_SYSTEM,
    messages: [{ role: 'user', content: buildGenerateMessage(input, offers) }],
  })
  checkStop(response.stop_reason)
  if (!response.parsed_output) throw new ClaudeOutputError('AI 응답 형식이 올바르지 않아요.')
  return response.parsed_output
}

export async function reviseItinerary(args: ReviseArgs): Promise<AiRevision> {
  if (isMock()) return mockRevision(args)
  const response = await anthropic().messages.parse({
    model: PLAN_MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(AiRevisionSchema) },
    system: REVISE_SYSTEM,
    messages: [{ role: 'user', content: buildReviseMessage(args) }],
  })
  checkStop(response.stop_reason)
  if (!response.parsed_output) throw new ClaudeOutputError('AI 응답 형식이 올바르지 않아요.')
  return response.parsed_output
}

export async function guessAirports(
  origin: string,
  destination: string,
): Promise<{ departureId: string; arrivalId: string }> {
  if (isMock()) return { departureId: 'ICN', arrivalId: 'KIX' }
  const response = await anthropic().messages.parse({
    model: LIGHT_MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low', format: zodOutputFormat(AirportGuessSchema) },
    messages: [
      {
        role: 'user',
        content: `출발지 "${origin}"에서 목적지 "${destination}"로 가는 여행입니다. 한국인 여행자가 가장 많이 쓰는 국제선 출발 공항과 도착 공항의 IATA 코드를 대문자 3글자로 알려주세요.`,
      },
    ],
  })
  checkStop(response.stop_reason)
  const out = response.parsed_output
  if (!out || !IATA.test(out.departureId) || !IATA.test(out.arrivalId)) {
    throw new ClaudeOutputError('공항 코드를 추정하지 못했어요. 직접 입력해주세요.')
  }
  return out
}
