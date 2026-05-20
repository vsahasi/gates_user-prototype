// src/components/workbench/FinancialAidView.tsx
'use client'
import { useState } from 'react'
import { SCHOOLS } from '@/lib/data/schools'
import type { FinancialAidViewData } from '@/lib/types'

export function projectNetPrice(input: {
  familyIncome: number
  netPriceMedian: number | null
  pctReceivingAid: number | null
}): number | null {
  if (input.netPriceMedian == null) return null
  const f = Math.max(0, Math.min(1, input.familyIncome / 200_000))
  const scale = 0.4 + f * 1.0
  return Math.round(input.netPriceMedian * scale)
}

interface Props {
  data: FinancialAidViewData
  onWalkThrough?: (schoolId: string) => void
}

export function FinancialAidView({ data: initial, onWalkThrough }: Props) {
  const [income, setIncome] = useState(initial.familyIncome)
  const rows = initial.schools
    .map((id) => SCHOOLS.find((s) => s.unitId === id))
    .filter(Boolean)
    .map((s) => ({
      school: s!,
      projected: projectNetPrice({
        familyIncome: income,
        netPriceMedian: s!.netPriceMedian,
        pctReceivingAid: s!.pctReceivingAid,
      }),
    }))

  return (
    <div className="rounded-xl border border-border/60 bg-white p-4 space-y-4">
      <h4 className="text-sm font-semibold">Net price by family income</h4>
      <div className="flex items-center gap-3">
        <label className="text-xs text-muted-foreground w-32">Family income</label>
        <input
          type="range"
          min={0}
          max={250000}
          step={5000}
          value={income}
          onChange={(e) => setIncome(Number(e.target.value))}
          className="flex-1"
          aria-label="Family income"
        />
        <span className="w-24 text-right text-xs tabular-nums">
          ${income.toLocaleString()}
        </span>
      </div>
      <div className="space-y-1">
        {rows.map(({ school, projected }) => (
          <div
            key={school.unitId}
            className="flex items-center gap-3 py-1 border-b border-border/30 last:border-0"
          >
            <div className="flex-1 text-sm truncate">{school.name}</div>
            <div className="text-sm tabular-nums">
              {projected != null ? `$${projected.toLocaleString()}` : '—'}
            </div>
            {onWalkThrough && (
              <button
                onClick={() => onWalkThrough(school.unitId)}
                className="text-xs text-[#1a6b5a] hover:underline"
              >
                Walk through →
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Estimates based on Scorecard median net price; actual aid depends on FAFSA + institutional aid.
      </p>
    </div>
  )
}
