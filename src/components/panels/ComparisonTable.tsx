// src/components/panels/ComparisonTable.tsx
import type { School } from '@/lib/types'
import { Info } from 'lucide-react'

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

function getCellHighlight(school: School, field: keyof School, allSchools: School[]): string {
  if (field === 'netPriceMedian' || field === 'inStateTuition' || field === 'medianLoanDebt') {
    const vals = allSchools.map((s) => s[field]).filter((v) => v != null) as number[]
    const min = Math.min(...vals)
    if (school[field] === min) return 'text-emerald-700 font-semibold'
  }
  if (field === 'gradRate' || field === 'medianEarnings10yr') {
    const vals = allSchools.map((s) => s[field]).filter((v) => v != null) as number[]
    const max = Math.max(...vals)
    if (school[field] === max) return 'text-emerald-700 font-semibold'
  }
  return ''
}

export function ComparisonTable({ schools, fields, labels }: ComparisonTableProps) {
  if (!schools.length) return null

  return (
    <div className="rounded-xl border border-border/50 bg-white shadow-sm overflow-hidden animate-slide-up">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-gradient-to-r from-[#1a6b5a]/5 to-transparent">
              <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#1a6b5a]">
                School
              </th>
              {fields.map((f) => (
                <th key={f} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {labels[f] ?? f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schools.map((school, i) => (
              <tr
                key={school.unitId}
                className={`border-b border-border/20 last:border-0 transition-colors hover:bg-[#1a6b5a]/[0.02] ${
                  i % 2 === 0 ? 'bg-white' : 'bg-[#fafaf8]/50'
                }`}
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{school.name}</span>
                  <span className="block text-[11px] text-muted-foreground/60">{school.city}, {school.state}</span>
                </td>
                {fields.map((f) => (
                  <td key={f} className={`px-4 py-3 whitespace-nowrap ${getCellHighlight(school, f, schools) || 'text-muted-foreground'}`}>
                    {formatValue(school, f)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 px-4 py-2.5 border-t border-border/30 bg-[#fafaf8]/50">
        <Info className="h-3 w-3 shrink-0" />
        Data from 2024. Verify current figures with each institution.
      </div>
    </div>
  )
}
