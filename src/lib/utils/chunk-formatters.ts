import type { SchoolType } from '@/lib/types'

export interface IpedsRecord {
  unitId: string
  name: string
  city: string
  state: string
  type: SchoolType
  inStateTuition: number
  outOfStateTuition: number
  gradRate: number
  requiresTestScore: boolean
  satRangeLow: number | null
  satRangeHigh: number | null
  cipCodes: string[]
  dataYear: number
}

export interface CDSEntry {
  unitId: string
  name: string
  city: string
  state: string
  type: SchoolType
  regularDecisionDeadline: string | null
  earlyDecisionDeadline: string | null
  earlyActionDeadline: string | null
  requiresTestScore: boolean
  requiresLettersOfRec: boolean
  requiresEssay: boolean
  aidTypes: string[]
  avgAidPackage: number | null
  pctReceivingAid: number | null
  medianGPA: number | null
  satMidpoint: number | null
  specialNotes: string[]
  dataYear: number
}

export type PineconeMetadata = Record<string, string | number | boolean | string[]>

function formatCurrency(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}

function formatPercent(n: number): string {
  return `${Math.round(n * 100)}%`
}

function formatDeadline(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function humanType(type: SchoolType): string {
  const map: Record<SchoolType, string> = {
    community_college: 'community college',
    '4_year_public': 'public four-year university',
    '4_year_private': 'private four-year university',
    tribal: 'tribal college',
    arts: 'arts college',
  }
  return map[type]
}

export function formatIpedsChunk(r: IpedsRecord): string {
  const parts: string[] = []
  parts.push(`${r.name} is a ${humanType(r.type)} in ${r.city}, ${r.state}.`)
  parts.push(`In-state tuition: ${formatCurrency(r.inStateTuition)}/year.`)
  parts.push(`Out-of-state tuition: ${formatCurrency(r.outOfStateTuition)}/year.`)
  parts.push(`Graduation rate: ${formatPercent(r.gradRate)}.`)
  if (r.requiresTestScore) {
    if (r.satRangeLow && r.satRangeHigh) {
      parts.push(`Test scores required. SAT range: ${r.satRangeLow}–${r.satRangeHigh}.`)
    } else {
      parts.push(`Test scores required.`)
    }
  } else {
    parts.push(`Test scores not required.`)
  }
  if (r.cipCodes.length > 0) {
    parts.push(`Programs offered in CIP areas: ${r.cipCodes.join(', ')}.`)
  }
  parts.push(`Data year: ${r.dataYear}.`)
  return parts.join(' ')
}

export function formatCdsChunk(e: CDSEntry): string {
  const parts: string[] = []
  parts.push(`${e.name} is a ${humanType(e.type)} in ${e.city}, ${e.state}.`)
  if (e.regularDecisionDeadline) {
    parts.push(`Regular decision deadline: ${formatDeadline(e.regularDecisionDeadline)}.`)
  }
  if (e.earlyDecisionDeadline) {
    parts.push(`Early decision deadline: ${formatDeadline(e.earlyDecisionDeadline)}.`)
  }
  if (e.earlyActionDeadline) {
    parts.push(`Early action deadline: ${formatDeadline(e.earlyActionDeadline)}.`)
  }
  parts.push(`Test scores: ${e.requiresTestScore ? 'required' : 'not required'}.`)
  parts.push(`Letters of recommendation: ${e.requiresLettersOfRec ? 'required' : 'not required'}.`)
  parts.push(`Essay: ${e.requiresEssay ? 'required' : 'not required'}.`)
  if (e.avgAidPackage !== null) {
    parts.push(`Average financial aid package: ${formatCurrency(e.avgAidPackage)}.`)
  }
  if (e.pctReceivingAid !== null) {
    parts.push(`${formatPercent(e.pctReceivingAid)} of students receive financial aid.`)
  }
  if (e.aidTypes.length > 0) {
    parts.push(`Aid types available: ${e.aidTypes.join(', ')}.`)
  }
  if (e.medianGPA !== null) {
    parts.push(`Median admitted GPA: ${e.medianGPA.toFixed(2)}.`)
  }
  if (e.satMidpoint !== null) {
    parts.push(`SAT midpoint: ${e.satMidpoint}.`)
  }
  if (e.specialNotes.length > 0) {
    parts.push(`Notes: ${e.specialNotes.join(' ')}.`)
  }
  parts.push(`Data year: ${e.dataYear}.`)
  return parts.join(' ')
}

export function buildIpedsMetadata(r: IpedsRecord): PineconeMetadata {
  const meta: PineconeMetadata = {
    unitId: r.unitId,
    name: r.name,
    state: r.state,
    type: r.type,
    city: r.city,
    dataSource: 'ipeds',
    dataYear: r.dataYear,
    inStateTuition: r.inStateTuition,
    outOfStateTuition: r.outOfStateTuition,
    gradRate: r.gradRate,
    requiresTestScore: r.requiresTestScore,
    satRangeLow: r.satRangeLow ?? -1,
    satRangeHigh: r.satRangeHigh ?? -1,
  }
  if (r.cipCodes.length > 0) meta['cipCodes'] = r.cipCodes
  return meta
}

export function buildCdsMetadata(e: CDSEntry): PineconeMetadata {
  return {
    unitId: e.unitId,
    name: e.name,
    state: e.state,
    type: e.type,
    city: e.city,
    dataSource: 'cds',
    dataYear: e.dataYear,
    regularDecisionDeadline: e.regularDecisionDeadline ?? '',
    earlyDecisionDeadline: e.earlyDecisionDeadline ?? '',
    earlyActionDeadline: e.earlyActionDeadline ?? '',
    requiresTestScore: e.requiresTestScore,
    requiresLettersOfRec: e.requiresLettersOfRec,
    requiresEssay: e.requiresEssay,
    avgAidPackage: e.avgAidPackage ?? -1,
    pctReceivingAid: e.pctReceivingAid ?? -1,
    medianGPA: e.medianGPA ?? -1,
    satMidpoint: e.satMidpoint ?? -1,
    aidTypes: e.aidTypes,
    specialNotes: e.specialNotes,
  }
}
