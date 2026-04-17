'use client'
// src/components/panels/TimelineChecklist.tsx
import { useState } from 'react'
import type { TimelineChecklistData } from '@/lib/types'
import { Calendar, ExternalLink, Check } from 'lucide-react'

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

  const completedCount = checked.size
  const totalCount = data.items.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <div className="rounded-xl border border-border/50 bg-white shadow-sm overflow-hidden animate-slide-up">
      {/* Header with progress */}
      <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-r from-[#1a6b5a]/5 to-transparent">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#1a6b5a]" />
            {data.title}
          </h3>
          <span className="text-[11px] font-medium text-muted-foreground">
            {completedCount}/{totalCount} complete
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#1a6b5a] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Timeline items */}
      <div className="divide-y divide-border/30">
        {data.items.map((item, i) => {
          const isChecked = checked.has(i)
          return (
            <div
              key={i}
              className={`flex gap-3 px-4 py-3.5 transition-colors ${isChecked ? 'bg-[#1a6b5a]/[0.02]' : 'hover:bg-[#fafaf8]'}`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleItem(i)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                  isChecked
                    ? 'border-[#1a6b5a] bg-[#1a6b5a] text-white'
                    : 'border-border/60 hover:border-[#1a6b5a]/40'
                }`}
              >
                {isChecked && <Check className="h-3 w-3" />}
              </button>

              {/* Timeline dot + line */}
              <div className="flex flex-col items-center shrink-0">
                <div className={`h-2.5 w-2.5 rounded-full border-2 ${isChecked ? 'border-[#1a6b5a] bg-[#1a6b5a]' : 'border-border bg-white'}`} />
                {i < data.items.length - 1 && (
                  <div className={`w-0.5 flex-1 mt-1 rounded-full ${isChecked ? 'bg-[#1a6b5a]/20' : 'bg-border/60'}`} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-medium ${isChecked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {item.task}
                    </p>
                    <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground/60 font-medium shrink-0 mt-0.5">{item.week}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  {item.deadline && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#e07856] bg-[#e07856]/8 px-2 py-0.5 rounded-full">
                      <Calendar className="h-3 w-3" />
                      Due {item.deadline}
                    </span>
                  )}
                  {item.resource && (
                    <a
                      href={item.resource}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1a6b5a] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Resource
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
