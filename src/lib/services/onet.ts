// src/lib/services/onet.ts

export interface ONETOccupation {
  code: string
  title: string
  description: string
  jobZone: number | null // 1-5, preparation needed; null when not yet fetched (v2.0 search doesn't include it)
  brightOutlook: boolean
  wages: { median: number; unit: string } | null
}

export interface ONETOccupationDetail extends ONETOccupation {
  education: string
  skills: string[]
  tasks: string[]
  relatedOccupations: { code: string; title: string }[]
}

export interface IONETService {
  searchOccupations(keyword: string): Promise<ONETOccupation[]>
  searchOccupationsEnriched(keyword: string, limit?: number): Promise<ONETOccupation[]>
  getOccupationDetail(code: string): Promise<ONETOccupationDetail | null>
}

// O*NET Web Services v2.0 — uses X-API-Key header auth.
// Register at https://services.onetcenter.org/developer/signup to get a key.
export class ONETService implements IONETService {
  private readonly baseUrl = 'https://services.onetcenter.org/ws'
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private get headers() {
    return { 'X-API-Key': this.apiKey, Accept: 'application/json' }
  }

  private async subFetch(code: string, path: string): Promise<Record<string, unknown> | null> {
    const r = await fetch(`${this.baseUrl}/online/occupations/${code}/${path}`, {
      headers: this.headers,
      next: { revalidate: 3600 },
    })
    if (!r.ok) return null
    return r.json()
  }

  // Fetch /job_zone and /wages in parallel and normalize to our flat shape.
  // Both enrichment paths (search-enriched + detail) use the same mapping.
  private async fetchJobZoneAndWages(
    code: string
  ): Promise<{ jobZone: number | null; wages: { median: number; unit: string } | null }> {
    const [jobZone, wages] = await Promise.all([
      this.subFetch(code, 'job_zone'),
      this.subFetch(code, 'wages'),
    ])
    const annual = wages?.['annual'] as Record<string, unknown> | undefined
    return {
      jobZone: jobZone?.['job_zone'] != null ? Number(jobZone['job_zone']) : null,
      wages: annual?.['median'] != null
        ? { median: Number(annual['median']), unit: 'annual' }
        : null,
    }
  }

  async searchOccupations(keyword: string): Promise<ONETOccupation[]> {
    const res = await fetch(
      `${this.baseUrl}/online/search?keyword=${encodeURIComponent(keyword)}`,
      { headers: this.headers, next: { revalidate: 3600 } }
    )

    if (!res.ok) throw new Error(`O*NET search error: ${res.status}`)
    const json = await res.json()

    // v2.0 search response: occupation[] with code, title, tags.bright_outlook.
    // job_zone, wages, description require separate sub-endpoint calls (see
    // searchOccupationsEnriched).
    return (json.occupation ?? []).slice(0, 5).map((o: Record<string, unknown>) => {
      const tags = (o['tags'] ?? {}) as Record<string, unknown>
      return {
        code: String(o['code']),
        title: String(o['title']),
        description: '',
        jobZone: null,
        brightOutlook: Boolean(tags['bright_outlook']),
        wages: null,
      }
    })
  }

  // Search + fan-out to /job_zone and /wages sub-endpoints for the top `limit`
  // hits. Needed because v2.0 search alone returns only code/title/tags.
  // Cost: 1 search call + 2*limit sub-calls (all parallel within a request).
  async searchOccupationsEnriched(keyword: string, limit = 3): Promise<ONETOccupation[]> {
    const results = await this.searchOccupations(keyword)
    const top = results.slice(0, limit)

    return Promise.all(
      top.map(async (occ) => ({ ...occ, ...(await this.fetchJobZoneAndWages(occ.code)) }))
    )
  }

  async getOccupationDetail(code: string): Promise<ONETOccupationDetail | null> {
    // v2.0 overview returns code/title/description/tags. Rich fields (job_zone,
    // wages, tasks, skills) live under sub-endpoints — fetch in parallel.
    const overviewRes = await fetch(
      `${this.baseUrl}/online/occupations/${code}/`,
      { headers: this.headers, next: { revalidate: 3600 } }
    )
    if (overviewRes.status === 404) return null
    if (!overviewRes.ok) throw new Error(`O*NET detail error: ${overviewRes.status}`)

    const overview = await overviewRes.json()
    const tags = (overview['tags'] ?? {}) as Record<string, unknown>

    const [jobZoneAndWages, tasks, skills] = await Promise.all([
      this.fetchJobZoneAndWages(code),
      this.subFetch(code, 'summary/tasks'),
      this.subFetch(code, 'summary/skills'),
    ])

    return {
      code,
      title: String(overview['title'] ?? ''),
      description: String(overview['description'] ?? ''),
      ...jobZoneAndWages,
      brightOutlook: Boolean(tags['bright_outlook']),
      education: String(overview['education'] ?? 'See O*NET for details'),
      skills: ((skills?.['element'] ?? []) as Record<string, unknown>[])
        .slice(0, 5)
        .map((s) => String(s['name'])),
      tasks: ((tasks?.['task'] ?? []) as Record<string, unknown>[])
        .slice(0, 4)
        .map((t) => String(t['statement'] ?? t['description'] ?? '')),
      relatedOccupations: ((overview['also_see'] ?? []) as Record<string, unknown>[])
        .slice(0, 3)
        .map((r) => ({ code: String(r['code']), title: String(r['title']) })),
    }
  }
}

export function createONETService(): IONETService {
  const apiKey = process.env.ONET_API_KEY
  if (!apiKey) throw new Error('ONET_API_KEY not set')
  return new ONETService(apiKey)
}
