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
    <div className="mt-2 text-[11px] text-muted-foreground">
      <button onClick={() => setOpen((o) => !o)} className="underline">
        {citations.length} source{citations.length === 1 ? '' : 's'}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 pl-3 list-disc">
          {citations.map((c) => (
            <li key={c.index}>{c.source}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
