// src/lib/services/scorecard.ts
import { numOrNull } from '@/lib/utils'

export interface ScorecardProgram {
  institutionName: string
  state: string
  cipCode: string
  credentialLevel: number
  medianEarnings: number
  medianDebt: number
  completionRate: number | null
}

export interface ScorecardInstitution {
  unitId: string
  name: string
  state: string
  // All numeric fields are nullable — Scorecard commonly returns null for
  // tuition, grad rate, earnings when data is suppressed or unreported.
  inStateTuition: number | null
  outOfStateTuition: number | null
  admissionRate: number | null
  gradRate: number | null
  medianEarnings10yr: number | null
  medianDebt: number | null
  netPrice: number | null
}

export interface ScorecardQueryParams {
  state?: string
  cipCode?: string
  credentialLevel?: number // 1=cert, 2=associate, 3=bachelor's
  perPage?: number
}

export interface ICollegeScorecardService {
  searchInstitutions(params: ScorecardQueryParams): Promise<ScorecardInstitution[]>
  getInstitution(unitId: string): Promise<ScorecardInstitution | null>
}

export class CollegeScorecardService implements ICollegeScorecardService {
  private readonly baseUrl = 'https://api.data.gov/ed/collegescorecard/v1'
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async searchInstitutions(params: ScorecardQueryParams): Promise<ScorecardInstitution[]> {
    const fields = [
      'id', 'school.name', 'school.state',
      'latest.cost.tuition.in_state', 'latest.cost.tuition.out_of_state',
      'latest.admissions.admission_rate.overall',
      'latest.completion.rate_suppressed.overall',
      'latest.earnings.10_yrs_after_entry.median',
      'latest.aid.median_debt.completers.overall',
      'latest.cost.avg_net_price.public',
    ].join(',')

    const queryParams = new URLSearchParams({
      api_key: this.apiKey,
      fields,
      per_page: String(params.perPage ?? 10),
    })

    if (params.state) queryParams.set('school.state', params.state)
    if (params.cipCode) {
      // Scorecard only exposes exact-match filters at cip_4_digit and
      // cip_6_digit granularity — there is NO cip_2_digit field. Intent
      // classifier emits 2-digit prefixes (e.g. "51" = Health Professions),
      // so we translate them into a 4-digit __range query: "51" → 5100..5199.
      const cip = params.cipCode.replace(/\./g, '')
      if (cip.length <= 2) {
        const lo = cip.padEnd(4, '0') // "51" → "5100"
        const hi = cip.padEnd(4, '9') // "51" → "5199"
        queryParams.set('latest.programs.cip_4_digit.code__range', `${lo}..${hi}`)
      } else if (cip.length <= 4) {
        queryParams.set('latest.programs.cip_4_digit.code', cip)
      } else {
        queryParams.set('latest.programs.cip_6_digit.code', cip)
      }
    }

    const res = await fetch(`${this.baseUrl}/schools?${queryParams}`, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) throw new Error(`Scorecard API error: ${res.status}`)

    const json = await res.json()
    return (json.results ?? []).map(this.mapToInstitution)
  }

  async getInstitution(unitId: string): Promise<ScorecardInstitution | null> {
    const fields = [
      'id', 'school.name', 'school.state',
      'latest.cost.tuition.in_state', 'latest.cost.tuition.out_of_state',
      'latest.admissions.admission_rate.overall',
      'latest.completion.rate_suppressed.overall',
      'latest.earnings.10_yrs_after_entry.median',
      'latest.aid.median_debt.completers.overall',
      'latest.cost.avg_net_price.public',
    ].join(',')

    const queryParams = new URLSearchParams({ api_key: this.apiKey, fields })
    const res = await fetch(`${this.baseUrl}/schools/${unitId}?${queryParams}`, {
      next: { revalidate: 3600 },
    })

    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Scorecard API error: ${res.status}`)

    const json = await res.json()
    return this.mapToInstitution(json.results?.[0] ?? json)
  }

  private mapToInstitution(raw: Record<string, unknown>): ScorecardInstitution {
    return {
      unitId: String(raw['id']),
      name: String(raw['school.name'] ?? ''),
      state: String(raw['school.state'] ?? ''),
      inStateTuition: numOrNull(raw['latest.cost.tuition.in_state']),
      outOfStateTuition: numOrNull(raw['latest.cost.tuition.out_of_state']),
      admissionRate: numOrNull(raw['latest.admissions.admission_rate.overall']),
      gradRate: numOrNull(raw['latest.completion.rate_suppressed.overall']),
      medianEarnings10yr: numOrNull(raw['latest.earnings.10_yrs_after_entry.median']),
      medianDebt: numOrNull(raw['latest.aid.median_debt.completers.overall']),
      netPrice: numOrNull(raw['latest.cost.avg_net_price.public']),
    }
  }
}

export function createScorecardService(): ICollegeScorecardService {
  const apiKey = process.env.COLLEGE_SCORECARD_API_KEY
  if (!apiKey) throw new Error('COLLEGE_SCORECARD_API_KEY not set')
  return new CollegeScorecardService(apiKey)
}
