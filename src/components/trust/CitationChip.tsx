// src/components/trust/CitationChip.tsx
'use client'
import { useState } from 'react'

interface Props {
  citations: Array<{ index: number; source: string }>
}

export function CitationFootnotes({ citations }: Props) {
  const [open, setOpen] = useState(false)
  if (citations.length === 0) return null
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="pen-underline font-mono uppercase tracking-wider text-[10.5px] text-ink-mid hover:text-forest inline-flex items-center gap-1.5"
      >
        <span className="text-forest">✦</span>
        {citations.length} source{citations.length === 1 ? '' : 's'}
        <span className="opacity-50">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ol className="mt-2 list-none pl-3 border-l-2 border-rule space-y-0.5">
          {citations.map((c) => (
            <li key={c.index} className="text-[11.5px] text-ink-mid">
              <span className="serif-numeral text-forest mr-2">[{c.index + 1}]</span>
              <span className="italic font-display">{c.source}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
