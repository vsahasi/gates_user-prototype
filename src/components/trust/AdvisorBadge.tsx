// src/components/trust/AdvisorBadge.tsx

interface Props {
  score: number | null
}

export function AdvisorBadge({ score }: Props) {
  if (score == null || score < 0.7) return null
  return (
    <span
      title={`Scored ${(score * 100).toFixed(0)}% on the advisor rubric (empathy, accuracy, actionability, completeness, non-paternalism)`}
      className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 border border-forest/30 bg-forest-soft text-forest"
    >
      <span aria-hidden className="text-forest">✦</span>
      advisor-reviewed
    </span>
  )
}
