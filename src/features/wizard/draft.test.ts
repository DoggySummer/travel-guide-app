import { describe, expect, test } from 'vitest'
import { EMPTY_DRAFT, applyDraftPatch, canProceed, parseKrw, toPlanInput, type WizardDraft } from './draft'

const filled: WizardDraft = {
  ...EMPTY_DRAFT,
  destination: '상해',
  startDate: '2026-12-18',
  endDate: '2026-12-21',
  companion: '연인',
  styles: ['맛집'],
  mustVisit: ['동방명주'],
  pace: '보통',
  budget: '보통',
  transport: '대중교통',
  departureId: 'ICN',
  arrivalId: 'PVG',
}

test('parseKrw는 쉼표와 원을 무시한다', () => {
  expect(parseKrw('562,000원')).toBe(562000)
  expect(parseKrw('')).toBeNull()
})

describe('canProceed', () => {
  test('목적지가 비면 못 넘어간다', () => {
    expect(canProceed('destination', EMPTY_DRAFT)).toBe(false)
    expect(canProceed('destination', filled)).toBe(true)
  })

  test('날짜는 1~14일이어야 한다', () => {
    expect(canProceed('dates', filled)).toBe(true)
    expect(canProceed('dates', { ...filled, endDate: '2027-01-01' })).toBe(false)
    expect(canProceed('dates', { ...filled, endDate: '2026-12-17' })).toBe(false)
  })

  test('항공: 가격 조회는 공항 코드 둘 다, 예약 완료는 편명·시각·금액, 불필요는 바로 통과', () => {
    expect(canProceed('flight', filled)).toBe(true)
    expect(canProceed('flight', { ...filled, arrivalId: 'PV' })).toBe(false)
    const booked: WizardDraft = {
      ...filled,
      flightMode: 'booked',
      bookedFlight: { flightNumber: 'KE893', outboundArrival: '2026-12-18T11:40', returnDeparture: '', totalKrw: '562,000' },
    }
    expect(canProceed('flight', booked)).toBe(false)
    expect(canProceed('flight', { ...booked, bookedFlight: { ...booked.bookedFlight, returnDeparture: '2026-12-21T19:30' } })).toBe(true)
    expect(canProceed('flight', { ...filled, flightMode: 'none', departureId: '' })).toBe(true)
  })

  test('숙소: 예약 완료는 이름과 금액이 필요하다', () => {
    expect(canProceed('stay', filled)).toBe(true)
    expect(canProceed('stay', { ...filled, stayMode: 'booked' })).toBe(false)
    expect(canProceed('stay', { ...filled, stayMode: 'booked', bookedStay: { name: '호텔', address: '', totalKrw: '300000' } })).toBe(true)
  })

  test('꼭 가고 싶은 곳과 추가 요청은 비어도 된다', () => {
    expect(canProceed('mustVisit', { ...filled, mustVisit: [] })).toBe(true)
    expect(canProceed('notes', filled)).toBe(true)
  })
})

describe('toPlanInput', () => {
  test('가격 조회 모드 입력을 PlanInput으로 바꾼다', () => {
    const result = toPlanInput(filled)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.input.flight).toEqual({ mode: 'search', departureId: 'ICN', arrivalId: 'PVG' })
      expect(result.input.stay).toEqual({ mode: 'search', area: '' })
    }
  })

  test('예약 완료 금액 문자열을 숫자로 바꾼다', () => {
    const result = toPlanInput({
      ...filled,
      flightMode: 'booked',
      bookedFlight: { flightNumber: 'KE893', outboundArrival: '2026-12-18T11:40', returnDeparture: '2026-12-21T19:30', totalKrw: '562,000' },
      stayMode: 'booked',
      bookedStay: { name: '호텔', address: '주소', totalKrw: '300,000원' },
    })
    expect(result.ok && result.input.flight).toMatchObject({ mode: 'booked', totalKrw: 562000 })
    expect(result.ok && result.input.stay).toMatchObject({ mode: 'booked', totalKrw: 300000 })
  })

  test('필수 값이 없으면 실패한다', () => {
    expect(toPlanInput(EMPTY_DRAFT).ok).toBe(false)
  })
})

describe('applyDraftPatch', () => {
  const guessed: WizardDraft = { ...filled, departureId: 'ICN', arrivalId: 'PVG' }

  test('목적지가 바뀌면 공항 코드를 비운다', () => {
    const next = applyDraftPatch(guessed, { destination: '오사카' })
    expect(next.destination).toBe('오사카')
    expect(next.departureId).toBe('')
    expect(next.arrivalId).toBe('')
  })

  test('목적지가 같은 값이면 공항 코드를 유지한다', () => {
    const next = applyDraftPatch(guessed, { destination: guessed.destination })
    expect(next.departureId).toBe('ICN')
    expect(next.arrivalId).toBe('PVG')
  })

  test('상관없는 변경에는 공항 코드를 유지한다', () => {
    const next = applyDraftPatch(guessed, { notes: '메모' })
    expect(next.departureId).toBe('ICN')
    expect(next.arrivalId).toBe('PVG')
  })

  test('출발지가 바뀌면 공항 코드를 비운다', () => {
    const next = applyDraftPatch(guessed, { origin: '부산' })
    expect(next.departureId).toBe('')
    expect(next.arrivalId).toBe('')
  })
})

describe('toPlanInput 메시지', () => {
  test('예약 항공편 편명이 비면 항공편 안내를 준다', () => {
    const result = toPlanInput({ ...filled, flightMode: 'booked' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('항공편')
  })

  test('귀국일이 빠르면 스키마 메시지를 그대로 준다', () => {
    const result = toPlanInput({ ...filled, endDate: '2026-12-17' })
    expect(result).toEqual({ ok: false, message: '귀국일이 출발일보다 빨라요.' })
  })
})
