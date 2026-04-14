// src/lib/services/scorecard.ts

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
  inStateTuition: number
  outOfStateTuition: number
  admissionRate: number | null
  gradRate: number
  medianEarnings10yr: number
  medianDebt: number
  netPrice: number
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
    if (params.cipCode) queryParams.set('latest.programs.cip_4_digit.code', params.cipCode)

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
      inStateTuition: Number(raw['latest.cost.tuition.in_state'] ?? 0),
      outOfStateTuition: Number(raw['latest.cost.tuition.out_of_state'] ?? 0),
      admissionRate: raw['latest.admissions.admission_rate.overall'] != null
        ? Number(raw['latest.admissions.admission_rate.overall'])
        : null,
      gradRate: Number(raw['latest.completion.rate_suppressed.overall'] ?? 0),
      medianEarnings10yr: Number(raw['latest.earnings.10_yrs_after_entry.median'] ?? 0),
      medianDebt: Number(raw['latest.aid.median_debt.completers.overall'] ?? 0),
      netPrice: Number(raw['latest.cost.avg_net_price.public'] ?? 0),
    }
  }
}

export function createScorecardService(): ICollegeScorecardService {
  const apiKey = process.env.COLLEGE_SCORECARD_API_KEY
  if (!apiKey) throw new Error('COLLEGE_SCORECARD_API_KEY not set')
  return new CollegeScorecardService(apiKey)
}
