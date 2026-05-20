// src/components/panels/ComparisonTable.tsx
import type { School } from '@/lib/types'

interface ComparisonTableProps {
  schools: School[]
  fields: Array<keyof School>
  labels: Record<string, string>
}

function formatValue(school: School, field: keyof School): string {
  const val = school[field]
  if (
    field === 'inStateTuition' ||
    field === 'outOfStateTuition' ||
    field === 'netPriceMedian' ||
    field === 'medianEarnings10yr' ||
    field === 'medianLoanDebt' ||
    field === 'avgAidPackage'
  ) {
    return val == null ? '—' : `$${Number(val).toLocaleString()}`
  }
  if (field === 'gradRate' || field === 'pctReceivingAid') {
    return val == null ? '—' : `${Math.round(Number(val) * 100)}%`
  }
  if (field === 'admissionRate') {
    return val == null ? 'Open' : `${Math.round(Number(val) * 100)}%`
  }
  if (val === null || val === undefined) return '—'
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}

function isBest(school: School, field: keyof School, allSchools: School[]): boolean {
  if (
    field === 'netPriceMedian' ||
    field === 'inStateTuition' ||
    field === 'medianLoanDebt'
  ) {
    const vals = allSchools.map((s) => s[field]).filter((v) => v != null) as number[]
    return school[field] != null && school[field] === Math.min(...vals)
  }
  if (field === 'gradRate' || field === 'medianEarnings10yr') {
    const vals = allSchools.map((s) => s[field]).filter((v) => v != null) as number[]
    return school[field] != null && school[field] === Math.max(...vals)
  }
  return false
}

export function ComparisonTable({ schools, fields, labels }: ComparisonTableProps) {
  if (!schools.length) return null

  return (
    <figure className="almanac-card overflow-hidden animate-slide-up">
      <figcaption className="px-5 pt-4 pb-3 border-b border-rule">
        <div className="eyebrow-accent">Table I</div>
        <h4 className="font-display text-[18px] text-ink mt-0.5 leading-tight">
          Side-by-side comparison
        </h4>
      </figcaption>
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-rule">
              <th className="text-left px-5 py-2.5 eyebrow text-ink">School</th>
              {fields.map((f) => (
                <th
                  key={f}
                  className="text-right px-4 py-2.5 eyebrow whitespace-nowrap"
                >
                  {labels[f] ?? f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {schools.map((school) => (
              <tr key={school.unitId} className="group hover:bg-paper-warm/60">
                <td className="px-5 py-3">
                  <div className="font-display text-[15px] text-ink leading-tight">
                    {school.name}
                  </div>
                  <div className="text-[11px] text-ink-soft mt-0.5">
                    {school.city}, {school.state}
                  </div>
                </td>
                {fields.map((f) => {
                  const best = isBest(school, f, schools)
                  return (
                    <td
                      key={f}
                      className={`px-4 py-3 text-right whitespace-nowrap tabular-nums font-mono text-[13px] ${
                        best ? 'text-forest-deep font-semibold' : 'text-ink-mid'
                      }`}
                    >
                      <span className="relative">
                        {formatValue(school, f)}
                        {best && (
                          <span
                            aria-hidden
                            className="absolute -left-3 top-1/2 -translate-y-1/2 text-forest"
                            style={{ fontSize: '8px' }}
                          >
                            ◆
                          </span>
                        )}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 px-5 py-2.5 border-t border-rule bg-paper-warm/40">
        <span className="font-display italic text-forest text-[12px]">◆</span>
        <span className="text-[11px] text-ink-soft">
          Diamond marks the best value in each column. Figures sourced from College Scorecard 2024; verify with each institution.
        </span>
      </div>
    </figure>
  )
}
