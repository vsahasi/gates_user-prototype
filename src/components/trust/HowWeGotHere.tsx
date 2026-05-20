// src/components/trust/HowWeGotHere.tsx
'use client'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Signals } from '@/lib/adaptive/signals'

interface Props {
  signals?: Signals
  citations?: Array<{ source: string }>
  intent?: string
  ragSources?: Array<{ id: string; label: string }>
}

export function HowWeGotHere({ signals, citations, intent, ragSources }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl bg-white border border-border/60 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground"
      >
        How we got here
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2 text-xs text-muted-foreground">
          {intent && (
            <div>
              <b>Intent:</b> {intent}
            </div>
          )}
          {signals && (
            <div>
              <b>Signals:</b> tone {signals.tone}, readiness {signals.readiness}, load{' '}
              {signals.cognitiveLoad}, deadlines {signals.deadlinePressure}
            </div>
          )}
          {ragSources && ragSources.length > 0 && (
            <div>
              <b>Retrieved:</b>
              <ul className="list-disc pl-4">
                {ragSources.map((s) => (
                  <li key={s.id}>{s.label}</li>
                ))}
              </ul>
            </div>
          )}
          {citations && citations.length > 0 && (
            <div>
              <b>Cited:</b>
              <ul className="list-disc pl-4">
                {citations.map((c, i) => (
                  <li key={i}>{c.source}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
