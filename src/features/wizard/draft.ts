import { tripDates } from '@/lib/dates'
import {
  MAX_TRIP_DAYS,
  PlanInputSchema,
  type BudgetLevel,
  type Companion,
  type Pace,
  type PlanInput,
  type Transport,
  type TravelStyle,
} from '@/lib/schema'

export type FlightMode = 'search' | 'booked' | 'none'
export type StayMode = 'search' | 'booked'

export type WizardDraft = {
  destination: string
  startDate: string
  endDate: string
  origin: string
  adults: number
  children: number
  companion: Companion | null
  styles: TravelStyle[]
  mustVisit: string[]
  pace: Pace | null
  budget: BudgetLevel | null
  transport: Transport | null
  flightMode: FlightMode
  departureId: string
  arrivalId: string
  bookedFlight: { flightNumber: string; outboundArrival: string; returnDeparture: string; totalKrw: string }
  stayMode: StayMode
  stayArea: string
  bookedStay: { name: string; address: string; totalKrw: string }
  notes: string
}

export const EMPTY_DRAFT: WizardDraft = {
  destination: '',
  startDate: '',
  endDate: '',
  origin: '인천',
  adults: 2,
  children: 0,
  companion: null,
  styles: [],
  mustVisit: [],
  pace: null,
  budget: null,
  transport: null,
  flightMode: 'search',
  departureId: '',
  arrivalId: '',
  bookedFlight: { flightNumber: '', outboundArrival: '', returnDeparture: '', totalKrw: '' },
  stayMode: 'search',
  stayArea: '',
  bookedStay: { name: '', address: '', totalKrw: '' },
  notes: '',
}

export const STEPS = [
  { id: 'destination', label: '목적지' },
  { id: 'dates', label: '날짜' },
  { id: 'people', label: '출발지·인원' },
  { id: 'companion', label: '동행' },
  { id: 'styles', label: '여행 스타일' },
  { id: 'mustVisit', label: '꼭 가고 싶은 곳' },
  { id: 'paceBudget', label: '강도·예산' },
  { id: 'transport', label: '교통수단' },
  { id: 'flight', label: '항공편' },
  { id: 'stay', label: '숙소' },
  { id: 'notes', label: '추가 요청' },
  { id: 'confirm', label: '확인' },
] as const
export type StepId = (typeof STEPS)[number]['id']

const IATA = /^[A-Z]{3}$/

export function parseKrw(s: string): number | null {
  const digits = s.replace(/[^0-9]/g, '')
  return digits ? Number(digits) : null
}

export function canProceed(step: StepId, d: WizardDraft): boolean {
  switch (step) {
    case 'destination':
      return d.destination.trim().length > 0
    case 'dates': {
      const days = tripDates(d.startDate, d.endDate).length
      return days > 0 && days <= MAX_TRIP_DAYS
    }
    case 'people':
      return d.origin.trim().length > 0 && d.adults >= 1
    case 'companion':
      return d.companion !== null
    case 'styles':
      return d.styles.length > 0
    case 'mustVisit':
      return true
    case 'paceBudget':
      return d.pace !== null && d.budget !== null
    case 'transport':
      return d.transport !== null
    case 'flight':
      if (d.flightMode === 'none') return true
      if (d.flightMode === 'search') return IATA.test(d.departureId) && IATA.test(d.arrivalId)
      return (
        d.bookedFlight.flightNumber.trim().length >= 2 &&
        d.bookedFlight.outboundArrival !== '' &&
        d.bookedFlight.returnDeparture !== '' &&
        parseKrw(d.bookedFlight.totalKrw) !== null
      )
    case 'stay':
      if (d.stayMode === 'search') return true
      return d.bookedStay.name.trim().length > 0 && parseKrw(d.bookedStay.totalKrw) !== null
    case 'notes':
      return d.notes.length <= 500
    case 'confirm':
      return toPlanInput(d).ok
  }
}

export function toPlanInput(d: WizardDraft): { ok: true; input: PlanInput } | { ok: false; message: string } {
  const flight =
    d.flightMode === 'search'
      ? { mode: 'search', departureId: d.departureId.trim().toUpperCase(), arrivalId: d.arrivalId.trim().toUpperCase() }
      : d.flightMode === 'booked'
        ? {
            mode: 'booked',
            flightNumber: d.bookedFlight.flightNumber,
            outboundArrival: d.bookedFlight.outboundArrival,
            returnDeparture: d.bookedFlight.returnDeparture,
            totalKrw: parseKrw(d.bookedFlight.totalKrw),
          }
        : { mode: 'none' }
  const stay =
    d.stayMode === 'search'
      ? { mode: 'search', area: d.stayArea }
      : { mode: 'booked', name: d.bookedStay.name, address: d.bookedStay.address, totalKrw: parseKrw(d.bookedStay.totalKrw) }

  const result = PlanInputSchema.safeParse({
    destination: d.destination,
    startDate: d.startDate,
    endDate: d.endDate,
    origin: d.origin,
    adults: d.adults,
    children: d.children,
    companion: d.companion,
    styles: d.styles,
    mustVisit: d.mustVisit,
    pace: d.pace,
    budget: d.budget,
    transport: d.transport,
    flight,
    stay,
    notes: d.notes,
  })
  if (!result.success) return { ok: false, message: '입력을 다시 확인해주세요.' }
  return { ok: true, input: result.data }
}
