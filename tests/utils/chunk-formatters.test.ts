import { describe, it, expect } from 'vitest'
import {
  formatIpedsChunk,
  formatCdsChunk,
  buildIpedsMetadata,
  buildCdsMetadata,
  type IpedsRecord,
  type CDSEntry,
} from '@/lib/utils/chunk-formatters'

const sampleIpeds: IpedsRecord = {
  unitId: '113364',
  name: 'City College of San Francisco',
  city: 'San Francisco',
  state: 'CA',
  type: 'community_college',
  inStateTuition: 1288,
  outOfStateTuition: 9528,
  gradRate: 0.17,
  requiresTestScore: false,
  satRangeLow: null,
  satRangeHigh: null,
  cipCodes: ['51.38', '52.02'],
  dataYear: 2023,
}

const sampleCds: CDSEntry = {
  unitId: '113364',
  name: 'City College of San Francisco',
  city: 'San Francisco',
  state: 'CA',
  type: 'community_college',
  regularDecisionDeadline: '2026-07-15',
  earlyDecisionDeadline: null,
  earlyActionDeadline: null,
  requiresTestScore: false,
  requiresLettersOfRec: false,
  requiresEssay: false,
  aidTypes: ['grants', 'work-study', 'loans'],
  avgAidPackage: 6800,
  pctReceivingAid: 0.72,
  medianGPA: null,
  satMidpoint: null,
  specialNotes: ['CADAA eligible', 'AB 540 eligible'],
  dataYear: 2024,
}

describe('formatIpedsChunk', () => {
  it('includes institution name and state', () => {
    const chunk = formatIpedsChunk(sampleIpeds)
    expect(chunk).toContain('City College of San Francisco')
    expect(chunk).toContain('San Francisco, CA')
  })

  it('includes tuition', () => {
    const chunk = formatIpedsChunk(sampleIpeds)
    expect(chunk).toContain('$1,288')
  })

  it('includes grad rate as percentage', () => {
    const chunk = formatIpedsChunk(sampleIpeds)
    expect(chunk).toContain('17%')
  })

  it('says "not required" when test scores not required', () => {
    const chunk = formatIpedsChunk(sampleIpeds)
    expect(chunk).toContain('not required')
  })

  it('includes data year', () => {
    const chunk = formatIpedsChunk(sampleIpeds)
    expect(chunk).toContain('2023')
  })
})

describe('formatCdsChunk', () => {
  it('includes institution name', () => {
    const chunk = formatCdsChunk(sampleCds)
    expect(chunk).toContain('City College of San Francisco')
  })

  it('includes application deadline', () => {
    const chunk = formatCdsChunk(sampleCds)
    expect(chunk).toContain('July 15, 2026')
  })

  it('includes aid package', () => {
    const chunk = formatCdsChunk(sampleCds)
    expect(chunk).toContain('$6,800')
  })

  it('includes special notes', () => {
    const chunk = formatCdsChunk(sampleCds)
    expect(chunk).toContain('CADAA eligible')
  })
})

describe('buildIpedsMetadata', () => {
  it('returns correct state and type', () => {
    const meta = buildIpedsMetadata(sampleIpeds)
    expect(meta.state).toBe('CA')
    expect(meta.type).toBe('community_college')
    expect(meta.dataSource).toBe('ipeds')
  })

  it('includes unitId', () => {
    const meta = buildIpedsMetadata(sampleIpeds)
    expect(meta.unitId).toBe('113364')
  })
})

describe('buildCdsMetadata', () => {
  it('marks dataSource as cds', () => {
    const meta = buildCdsMetadata(sampleCds)
    expect(meta.dataSource).toBe('cds')
  })

  it('includes unitId', () => {
    const meta = buildCdsMetadata(sampleCds)
    expect(meta.unitId).toBe('113364')
  })
})
