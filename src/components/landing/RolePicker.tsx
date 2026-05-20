// src/components/landing/RolePicker.tsx
'use client'

type Role = 'student' | 'adult'

const ROLES: Array<{
  id: Role
  numeral: string
  title: string
  italic: string
  desc: string
}> = [
  {
    id: 'student',
    numeral: 'I.',
    title: 'I am a',
    italic: 'student',
    desc: 'Exploring careers, building a shortlist, planning the next step.',
  },
  {
    id: 'adult',
    numeral: 'II.',
    title: 'I am a',
    italic: 'caring adult',
    desc: 'Helping a student you love — parent, counselor, mentor, family.',
  },
]

export function RolePicker({ onPick }: { onPick: (r: Role) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {ROLES.map((r) => (
        <button
          key={r.id}
          onClick={() => onPick(r.id)}
          className="group relative text-left almanac-card hover:border-forest transition-all duration-200 px-6 py-5 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(13,74,61,0.10)]"
        >
          <div className="flex items-start gap-5">
            <span
              aria-hidden
              className="font-display serif-numeral text-[34px] leading-none text-forest opacity-50 group-hover:opacity-100 transition-opacity"
            >
              {r.numeral}
            </span>
            <div className="flex-1">
              <div className="font-display text-[22px] leading-tight text-ink">
                {r.title}{' '}
                <span className="italic font-light text-forest">{r.italic}</span>
              </div>
              <p className="text-[14px] text-ink-mid leading-relaxed mt-1.5">{r.desc}</p>
            </div>
            <span
              aria-hidden
              className="text-ink-faint group-hover:text-forest group-hover:translate-x-1 transition-all font-display text-xl mt-1"
            >
              →
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
