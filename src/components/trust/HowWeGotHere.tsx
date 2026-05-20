// src/components/trust/HowWeGotHere.tsx
'use client'
import type { Signals } from '@/lib/adaptive/signals'

interface Props {
  signals?: Signals
  citations?: Array<{ source: string }>
  intent?: string
  ragSources?: Array<{ id: string; label: string }>
}

const TONE_LABEL: Record<Signals['tone'], string> = {
  calm: 'calm',
  anxious: 'anxious',
  overwhelmed: 'overwhelmed',
  excited: 'excited',
  confused: 'confused',
}

export function HowWeGotHere({ signals, citations, intent, ragSources }: Props) {
  if (!signals && !citations?.length && !intent && !ragSources?.length) return null
  return (
    <div className="space-y-3">
      {intent && (
        <Row label="Intent">
          <span className="font-mono text-[11px]">{intent}</span>
        </Row>
      )}
      {signals && (
        <Row label="Signals">
          <div className="flex flex-wrap gap-1.5">
            <Pill k="tone" v={TONE_LABEL[signals.tone]} />
            <Pill k="readiness" v={signals.readiness} />
            <Pill k="load" v={signals.cognitiveLoad} />
            <Pill k="deadlines" v={signals.deadlinePressure} />
          </div>
        </Row>
      )}
      {ragSources && ragSources.length > 0 && (
        <Row label="Retrieved">
          <ul className="text-[11.5px] text-ink-mid space-y-0.5">
            {ragSources.map((s) => (
              <li key={s.id} className="font-display italic">
                · {s.label}
              </li>
            ))}
          </ul>
        </Row>
      )}
      {citations && citations.length > 0 && (
        <Row label="Cited">
          <ul className="text-[11.5px] text-ink-mid space-y-0.5">
            {citations.map((c, i) => (
              <li key={i} className="font-display italic">
                · {c.source}
              </li>
            ))}
          </ul>
        </Row>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      {children}
    </div>
  )
}

function Pill({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 font-mono text-[10px] uppercase tracking-wider border border-rule rounded-sm px-1.5 py-0.5 bg-paper">
      <span className="text-ink-soft">{k}</span>
      <span className="text-ink">{v}</span>
    </span>
  )
}
