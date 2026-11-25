import { Chip } from '@/components/Chip'
import { formatShortDate } from '@/lib/format'
import type { Day } from '@/lib/schema'

export function DayChips({ days, index, onChange }: { days: Day[]; index: number; onChange: (i: number) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="일차 선택">
      {days.map((day, i) => (
        <Chip key={day.date} role="tab" aria-selected={i === index} selected={i === index} onClick={() => onChange(i)}>
          {i + 1}일차 <span className="ml-1 opacity-60">{formatShortDate(day.date)}</span>
        </Chip>
      ))}
    </div>
  )
}
