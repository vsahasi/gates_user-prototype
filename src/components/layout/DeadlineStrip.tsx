// src/components/layout/DeadlineStrip.tsx
'use client'
import type { Deadline, DeadlinePressure } from '@/lib/adaptive/signals'

interface Props {
  deadlines: Deadline[]
  pressure: DeadlinePressure
}

export function DeadlineStrip({ deadlines, pressure }: Props) {
  if (pressure === 'none') return null
  const sorted = [...deadlines].sort((a, b) => a.dueAt - b.dueAt).slice(0, 2)
  const bg = pressure === 'imminent' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
  const fg = pressure === 'imminent' ? 'text-rose-900' : 'text-amber-900'
  return (
    <div className={`border-b ${bg}`}>
      <div className={`mx-auto max-w-5xl flex items-center gap-4 px-4 py-2 text-xs ${fg}`}>
        <span className="font-semibold uppercase tracking-wider">
          {pressure === 'imminent' ? 'Due soon' : 'Upcoming'}
        </span>
        {sorted.map((d) => {
          const days = Math.max(0, Math.ceil((d.dueAt - Date.now()) / (24 * 60 * 60 * 1000)))
          return (
            <span key={d.id}>
              {d.label} <span className="opacity-70">· in {days} day{days === 1 ? '' : 's'}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
