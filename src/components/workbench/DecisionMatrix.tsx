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
}

export function DecisionMatrix({ data: initial, onAskWhy }: Props) {
  const [data, setData] = useState(initial)
  const ranked = rankOptions(data)
  const maxScore = Math.max(...ranked.map((r) => r.score), 1)

  function setWeight(criterionId: string, weight: number) {
    setData({
      ...data,
      criteria: data.criteria.map((c) =>
        c.id === criterionId ? { ...c, weight } : c,
      ),
    })
  }

  return (
    <div className="rounded-xl border border-border/60 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Decision matrix</h4>
        {onAskWhy && (
          <button
            onClick={() =>
              onAskWhy(Object.fromEntries(data.criteria.map((c) => [c.id, c.weight])))
            }
            className="text-xs text-[#1a6b5a] hover:underline"
          >
            Explain this ranking →
          </button>
        )}
      </div>
      <div className="space-y-3">
        {data.criteria.map((c) => (
          <div key={c.id} className="flex items-center gap-3">
            <label className="w-24 text-xs text-muted-foreground">{c.label}</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={c.weight}
              onChange={(e) => setWeight(c.id, Number(e.target.value))}
              className="flex-1"
              aria-label={`Weight for ${c.label}`}
            />
            <span className="w-10 text-right text-xs tabular-nums">
              {Math.round(c.weight * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-2 border-t border-border/40">
        {ranked.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3">
            <div className="w-6 text-xs text-muted-foreground">#{i + 1}</div>
            <div className="flex-1 text-sm">{r.label}</div>
            <div className="w-32 h-2 rounded-full bg-[#1a6b5a]/10 overflow-hidden">
              <div
                className="h-full bg-[#1a6b5a]"
                style={{ width: `${(r.score / maxScore) * 100}%` }}
              />
            </div>
            <div className="w-10 text-right text-xs tabular-nums">{r.score.toFixed(1)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
