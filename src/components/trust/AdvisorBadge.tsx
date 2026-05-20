// src/components/trust/AdvisorBadge.tsx
import { ShieldCheck } from 'lucide-react'

interface Props {
  score: number | null
}

export function AdvisorBadge({ score }: Props) {
  if (score == null || score < 0.7) return null
  return (
    <span
      title={`Scored ${(score * 100).toFixed(0)}% on the advisor rubric (empathy, accuracy, actionability, completeness, non-paternalism)`}
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800"
    >
      <ShieldCheck className="h-3 w-3" /> advisor-rubric
    </span>
  )
}
