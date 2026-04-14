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
    return `$${Number(val).toLocaleString()}`
  }
  if (field === 'gradRate' || field === 'admissionRate' || field === 'pctReceivingAid') {
    return val === null ? 'Open Admission' : `${Math.round(Number(val) * 100)}%`
  }
  if (val === null || val === undefined) return '—'
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}

export function ComparisonTable({ schools, fields, labels }: ComparisonTableProps) {
  if (!schools.length) return null

  return (
    <div className="rounded-lg border bg-card overflow-x-auto my-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">School</th>
            {fields.map((f) => (
              <th key={f} className="text-left px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">
                {labels[f] ?? f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schools.map((school, i) => (
            <tr key={school.unitId} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
              <td className="px-4 py-2 font-medium">{school.name}</td>
              {fields.map((f) => (
                <td key={f} className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                  {formatValue(school, f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground px-4 py-2 border-t">
        Data from 2024. Verify current figures with each institution.
      </p>
    </div>
  )
}
