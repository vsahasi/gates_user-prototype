// src/components/workbench/SuggestedReplies.tsx
'use client'
import type { SuggestedRepliesData } from '@/lib/types'

interface Props {
  data: SuggestedRepliesData
  onSelect?: (text: string) => void
}

export function SuggestedReplies({ data, onSelect }: Props) {
  if (!data.options?.length) return null
  return (
    <div className="mt-4 space-y-2 stagger">
      <div className="eyebrow text-ink-soft">A few ways to answer · tap one to edit</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {data.options.map((opt, i) => (
          <button
            key={`${i}-${opt}`}
            onClick={() => onSelect?.(opt)}
            className="group text-left almanac-card px-4 py-3.5 hover:border-forest hover:bg-forest-soft transition-all duration-200 hover:shadow-[0_6px_18px_rgba(13,74,61,0.08)] hover:-translate-y-[1px]"
          >
            <div className="flex items-start gap-2.5">
              <span className="font-display italic text-forest text-[15px] leading-none mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
                ›
              </span>
              <span className="text-[14px] text-ink-mid leading-snug group-hover:text-ink">
                {opt}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
