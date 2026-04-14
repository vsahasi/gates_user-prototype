// src/lib/services/onet.ts

export interface ONETOccupation {
  code: string
  title: string
  description: string
  jobZone: number // 1-5, preparation needed
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
  getOccupationDetail(code: string): Promise<ONETOccupationDetail | null>
}

export class ONETService implements IONETService {
  private readonly baseUrl = 'https://services.onetcenter.org/ws'
  private readonly authHeader: string

  constructor(username: string, password: string) {
    this.authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
  }

  async searchOccupations(keyword: string): Promise<ONETOccupation[]> {
    const res = await fetch(
      `${this.baseUrl}/search?keyword=${encodeURIComponent(keyword)}&client=gates_prototype`,
      {
        headers: { Authorization: this.authHeader, Accept: 'application/json' },
        next: { revalidate: 3600 },
      }
    )

    if (!res.ok) throw new Error(`O*NET search error: ${res.status}`)
    const json = await res.json()

    return (json.occupation ?? []).slice(0, 5).map((o: Record<string, unknown>) => ({
      code: String(o['code']),
      title: String(o['title']),
      description: String(o['description'] ?? ''),
      jobZone: Number(o['job_zone'] ?? 3),
      brightOutlook: Boolean(o['bright_outlook']),
      wages: null,
    }))
  }

  async getOccupationDetail(code: string): Promise<ONETOccupationDetail | null> {
    const res = await fetch(
      `${this.baseUrl}/occupations/${code}?client=gates_prototype`,
      {
        headers: { Authorization: this.authHeader, Accept: 'application/json' },
        next: { revalidate: 3600 },
      }
    )

    if (res.status === 404) return null
    if (!res.ok) throw new Error(`O*NET detail error: ${res.status}`)

    const json = await res.json()
    return {
      code,
      title: String(json['title'] ?? ''),
      description: String(json['description'] ?? ''),
      jobZone: Number(json['job_zone'] ?? 3),
      brightOutlook: Boolean(json['bright_outlook']),
      wages: json['wages']
        ? { median: Number(json['wages']['median']), unit: 'annual' }
        : null,
      education: String(json['education'] ?? 'See O*NET for details'),
      skills: (json['skills'] ?? []).slice(0, 5).map((s: Record<string, unknown>) => String(s['name'])),
      tasks: (json['tasks'] ?? []).slice(0, 4).map((t: Record<string, unknown>) => String(t['description'])),
      relatedOccupations: (json['related_occupations'] ?? [])
        .slice(0, 3)
        .map((r: Record<string, unknown>) => ({ code: String(r['code']), title: String(r['title']) })),
    }
  }
}

export function createONETService(): IONETService {
  const username = process.env.ONET_USERNAME
  const password = process.env.ONET_PASSWORD
  if (!username || !password) throw new Error('ONET_USERNAME / ONET_PASSWORD not set')
  return new ONETService(username, password)
}
