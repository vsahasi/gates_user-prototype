// src/components/workbench/DecisionMatrix.tsx
'use client'
import { useState } from 'react'
import type { DecisionMatrixData } from '@/lib/types'

export function rankOptions(d: DecisionMatrixData): Array<{ id: string; label: string; score: number }> {
  return d.options
    .map((o) => {
      const score = d.criteria.reduce(
        (acc, c) => acc + (o.scores[c.id] ?? 0) * c.weight,
        0,
      )
      return { id: o.id, label: o.label, score }
    })
    .sort((a, b) => b.score - a.score)
}

interface Props {
  data: DecisionMatrixData
  onAskWhy?: (weights: Record<string, number>) => void
  onChange?: (next: DecisionMatrixData) => void
}

export function DecisionMatrix({ data: initial, onAskWhy, onChange }: Props) {
  const [data, setData] = useState(initial)
  const ranked = rankOptions(data)
  const maxScore = Math.max(...ranked.map((r) => r.score), 1)

  function setWeight(criterionId: string, weight: number) {
    const next = {
      ...data,
      criteria: data.criteria.map((c) =>
        c.id === criterionId ? { ...c, weight } : c,
      ),
    }
    setData(next)
    onChange?.(next)
  }

  const RANKS = ['I', 'II', 'III', 'IV', 'V', 'VI']

  return (
    <figure className="almanac-card animate-slide-up">
      <figcaption className="px-5 pt-4 pb-3 border-b border-rule flex items-baseline justify-between gap-4">
        <div>
          <div className="eyebrow-accent">Decision matrix</div>
          <h4 className="font-display text-[18px] text-ink mt-0.5 leading-tight">
            Weighted by what matters to you
          </h4>
        </div>
        {onAskWhy && (
          <button
            onClick={() =>
              onAskWhy(Object.fromEntries(data.criteria.map((c) => [c.id, c.weight])))
            }
            className="pen-underline text-[12px] text-forest"
          >
            Explain this ranking →
          </button>
        )}
      </figcaption>

      <div className="px-5 py-4 border-b border-rule">
        <div className="caps-sm mb-3">Adjust your priorities</div>
        <div className="space-y-2.5">
          {data.criteria.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <label className="w-24 text-[12.5px] text-ink-mid font-display">{c.label}</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={c.weight}
                onChange={(e) => setWeight(c.id, Number(e.target.value))}
                className="flex-1 accent-forest"
                aria-label={`Weight for ${c.label}`}
              />
              <span className="w-10 text-right tabular-nums font-mono text-[11.5px] text-ink-soft">
                {Math.round(c.weight * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <ol className="px-5 py-4 space-y-2">
        {ranked.map((r, i) => (
          <li key={r.id} className="flex items-center gap-3">
            <span className="serif-numeral text-[14px] w-7 text-forest opacity-70">
              {RANKS[i] ?? `${i + 1}.`}
            </span>
            <span className="flex-1 font-display text-[15px] text-ink leading-tight">
              {r.label}
            </span>
            <div className="w-36 h-[3px] rounded-sm bg-paper-deep overflow-hidden">
              <div
                className="h-full bg-forest transition-all duration-300"
                style={{ width: `${(r.score / maxScore) * 100}%` }}
              />
            </div>
            <span className="w-12 text-right tabular-nums font-mono text-[12px] text-ink-mid">
              {r.score.toFixed(1)}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  )
}
