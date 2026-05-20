'use client'
// src/components/panels/TimelineChecklist.tsx
import { useState } from 'react'
import type { TimelineChecklistData } from '@/lib/types'

export function TimelineChecklist({ data }: { data: TimelineChecklistData }) {
  const [checked, setChecked] = useState<Set<number>>(new Set())

  function toggleItem(index: number) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const completed = checked.size
  const total = data.items.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <figure className="almanac-card overflow-hidden animate-slide-up">
      <figcaption className="px-5 pt-4 pb-3 border-b border-rule">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="eyebrow-accent">Calendar</div>
            <h4 className="font-display text-[19px] text-ink mt-0.5 leading-tight">
              {data.title}
            </h4>
          </div>
          <div className="text-right shrink-0">
            <div className="serif-numeral text-[24px] text-forest-deep leading-none">
              {completed}<span className="text-ink-faint">/{total}</span>
            </div>
            <div className="eyebrow mt-1">{pct}% done</div>
          </div>
        </div>
        <div className="h-[2px] w-full mt-3 bg-rule overflow-hidden">
          <div
            className="h-full bg-forest transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </figcaption>

      <ol className="px-2 py-3">
        {data.items.map((item, i) => {
          const isChecked = checked.has(i)
          const isLast = i === data.items.length - 1
          return (
            <li
              key={i}
              className={`group relative flex gap-3 px-3 py-3 rounded-sm transition-colors ${
                isChecked ? 'opacity-60' : 'hover:bg-paper-warm/40'
              }`}
            >
              {/* Marker column */}
              <div className="flex flex-col items-center shrink-0 w-6">
                <button
                  onClick={() => toggleItem(i)}
                  aria-label={isChecked ? 'Mark incomplete' : 'Mark complete'}
                  className={`h-5 w-5 rounded-full border transition-all flex items-center justify-center ${
                    isChecked
                      ? 'bg-forest border-forest text-paper'
                      : 'bg-card border-rule-strong hover:border-forest'
                  }`}
                >
                  {isChecked && (
                    <span className="font-display text-[12px] leading-none">✓</span>
                  )}
                </button>
                {!isLast && (
                  <span
                    className={`w-px flex-1 mt-1 ${
                      isChecked ? 'bg-forest/40' : 'bg-rule'
                    }`}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0 pb-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <h5
                    className={`font-display text-[15px] leading-snug ${
                      isChecked ? 'text-ink-soft line-through' : 'text-ink'
                    }`}
                  >
                    {item.task}
                  </h5>
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft shrink-0 mt-0.5">
                    {item.week}
                  </span>
                </div>
                <p className="text-[13px] text-ink-mid mt-1 leading-relaxed">
                  {item.detail}
                </p>
                {(item.deadline || item.resource) && (
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {item.deadline && (
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-mono text-rust border border-rust/25 bg-rust-soft px-2 py-0.5 rounded-sm">
                        <span className="text-rust" aria-hidden>◷</span>
                        due {item.deadline}
                      </span>
                    )}
                    {item.resource && (
                      <a
                        href={item.resource}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pen-underline text-[11.5px] text-forest hover:text-forest-deep transition-colors"
                      >
                        ↗ resource
                      </a>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
