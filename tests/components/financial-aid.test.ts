// tests/components/financial-aid.test.ts
import { describe, it, expect } from 'vitest'
import { projectNetPrice } from '@/components/workbench/FinancialAidView'

describe('projectNetPrice', () => {
  it('scales the median net price by income', () => {
    const lowIncome = projectNetPrice({
      familyIncome: 20000,
      netPriceMedian: 10000,
      pctReceivingAid: 0.9,
    })
    const highIncome = projectNetPrice({
      familyIncome: 180000,
      netPriceMedian: 10000,
      pctReceivingAid: 0.4,
    })
    expect(lowIncome).toBeLessThan(highIncome!)
  })

  it('returns null when no median is available', () => {
    expect(
      projectNetPrice({
        familyIncome: 65000,
        netPriceMedian: null,
        pctReceivingAid: 0.75,
      }),
    ).toBeNull()
  })
})
