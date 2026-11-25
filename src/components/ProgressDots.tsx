export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${total}단계 중 ${current + 1}단계`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full ${i === current ? 'w-4 bg-ink' : i < current ? 'w-1.5 bg-muted' : 'w-1.5 bg-hairline'}`}
        />
      ))}
    </div>
  )
}
