// src/lib/eval/accuracy.ts
import { SCHOOLS } from '@/lib/data/schools'

export interface FactCheck {
  kind: 'admit_rate' | 'in_state_tuition' | 'grad_rate' | 'median_earnings_10yr'
  unitId: string
  value: number
  tolerance: number
}

export function checkFact(response: string, fact: FactCheck): { ok: boolean; reason: string } {
  const school = SCHOOLS.find((s) => s.unitId === fact.unitId)
  if (!school) return { ok: false, reason: 'unknown school' }
  const numbers = Array.from(response.matchAll(/(\$?\d[\d,]*\.?\d*)\s*%?/g)).map((m) => {
    const raw = m[1].replace(/[$,]/g, '')
    return parseFloat(raw)
  })
  const target = fact.value
  if (fact.kind === 'admit_rate' || fact.kind === 'grad_rate') {
    return {
      ok: numbers.some(
        (n) =>
          Math.abs(n - target) <= fact.tolerance ||
          Math.abs(n / 100 - target) <= fact.tolerance,
      ),
      reason: numbers.length ? 'no number within tolerance' : 'no number found',
    }
  }
  return {
    ok: numbers.some((n) => Math.abs(n - target) <= fact.tolerance),
    reason: numbers.length ? 'no number within tolerance' : 'no number found',
  }
}
