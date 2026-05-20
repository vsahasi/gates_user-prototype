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
  onChange?: (next: FinancialAidViewData) => void
}

export function FinancialAidView({ data: initial, onWalkThrough, onChange }: Props) {
  const [income, setIncome] = useState(initial.familyIncome)
  function setIncomeAndEmit(v: number) {
    setIncome(v)
    onChange?.({ ...initial, familyIncome: v })
  }
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

  const minProjected = rows.reduce<number | null>(
    (m, r) => (r.projected != null && (m == null || r.projected < m) ? r.projected : m),
    null,
  )

  return (
    <figure className="almanac-card animate-slide-up">
      <figcaption className="px-5 pt-4 pb-3 border-b border-rule">
        <div className="eyebrow-accent">Affordability</div>
        <h4 className="font-display text-[18px] text-ink mt-0.5 leading-tight">
          Net price by family income
        </h4>
      </figcaption>

      <div className="px-5 py-4 border-b border-rule">
        <div className="flex items-baseline justify-between mb-2">
          <span className="caps-sm">Family income</span>
          <span className="serif-numeral text-[22px] text-forest-deep tabular-nums">
            ${income.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={250000}
          step={5000}
          value={income}
          onChange={(e) => setIncomeAndEmit(Number(e.target.value))}
          className="w-full accent-forest"
          aria-label="Family income"
        />
        <div className="flex justify-between mt-1 text-[10.5px] font-mono text-ink-faint">
          <span>$0</span>
          <span>$125k</span>
          <span>$250k</span>
        </div>
      </div>

      <ul className="divide-y divide-rule">
        {rows.map(({ school, projected }) => {
          const isCheapest = projected != null && projected === minProjected
          return (
            <li
              key={school.unitId}
              className="flex items-center gap-4 px-5 py-3 hover:bg-paper-warm/40"
            >
              <div className="flex-1 min-w-0">
                <div className="font-display text-[15px] text-ink truncate leading-tight">
                  {school.name}
                </div>
                <div className="text-[11px] text-ink-soft mt-0.5">
                  {school.city}, {school.state}
                </div>
              </div>
              <div
                className={`tabular-nums font-mono text-[14px] shrink-0 ${
                  isCheapest ? 'text-forest-deep font-semibold' : 'text-ink-mid'
                }`}
              >
                {projected != null ? `$${projected.toLocaleString()}` : '—'}
                {isCheapest && (
                  <span className="ml-1 text-forest" aria-hidden>◆</span>
                )}
              </div>
              {onWalkThrough && (
                <button
                  onClick={() => onWalkThrough(school.unitId)}
                  className="pen-underline text-[12px] text-forest shrink-0"
                >
                  walk through →
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <p className="px-5 py-2.5 border-t border-rule bg-paper-warm/40 text-[11px] text-ink-soft">
        Estimates based on Scorecard median net price. Actual aid depends on FAFSA and institutional aid.
      </p>
    </figure>
  )
}
