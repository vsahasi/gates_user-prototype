// tests/components/decision-matrix.test.ts
import { describe, it, expect } from 'vitest'
import { rankOptions } from '@/components/workbench/DecisionMatrix'
import type { DecisionMatrixData } from '@/lib/types'

describe('rankOptions', () => {
  it('weights criteria correctly', () => {
    const data: DecisionMatrixData = {
      options: [
        { id: 'a', label: 'A', scores: { cost: 10, fit: 0 } },
        { id: 'b', label: 'B', scores: { cost: 0, fit: 10 } },
      ],
      criteria: [
        { id: 'cost', label: 'Cost', weight: 0.8 },
        { id: 'fit', label: 'Fit', weight: 0.2 },
      ],
    }
    const ranked = rankOptions(data)
    expect(ranked[0].id).toBe('a')
    expect(ranked[0].score).toBeCloseTo(8)
    expect(ranked[1].id).toBe('b')
    expect(ranked[1].score).toBeCloseTo(2)
  })

  it('handles missing criterion scores as zero', () => {
    const data: DecisionMatrixData = {
      options: [{ id: 'a', label: 'A', scores: {} }],
      criteria: [{ id: 'cost', label: 'Cost', weight: 1 }],
    }
    const ranked = rankOptions(data)
    expect(ranked[0].score).toBe(0)
  })
})
