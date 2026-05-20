// src/components/landing/RolePicker.tsx
'use client'

type Role = 'student' | 'adult'

const ROLES: Array<{
  id: Role
  eyebrow: string
  prefix: string
  accent: string
  desc: string
}> = [
  {
    id: 'student',
    eyebrow: 'For the one choosing',
    prefix: 'I’m a',
    accent: 'student',
    desc: 'Explore careers, narrow a shortlist, plan the next step.',
  },
  {
    id: 'adult',
    eyebrow: 'For the one supporting',
    prefix: 'I’m a',
    accent: 'caring adult',
    desc: 'Parent, counselor, mentor — see what your student is working through.',
  },
]

export function RolePicker({ onPick }: { onPick: (r: Role) => void }) {
  return (
    <div className="flex flex-col gap-5">
      {ROLES.map((r) => (
        <button
          key={r.id}
          onClick={() => onPick(r.id)}
          className="group block w-full text-left almanac-card hover:border-forest hover:shadow-[0_12px_32px_rgba(13,74,61,0.10)] transition-all duration-300 px-7 py-8"
        >
          <div className="flex items-start justify-between gap-5">
            <div className="space-y-3 min-w-0">
              <div className="eyebrow">{r.eyebrow}</div>
              <div className="font-display text-[34px] leading-[1.05] text-ink group-hover:text-forest-deep transition-colors">
                {r.prefix}{' '}
                <span className="italic font-light text-forest">{r.accent}</span>
              </div>
              <p className="text-[13.5px] text-ink-mid leading-relaxed max-w-[34ch]">
                {r.desc}
              </p>
            </div>
            <span
              aria-hidden
              className="font-display text-[28px] text-ink-faint group-hover:text-forest group-hover:translate-x-1 transition-all shrink-0 leading-none mt-1.5"
            >
              →
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
