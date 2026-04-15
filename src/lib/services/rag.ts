import { SCHOOLS, searchSchools } from '@/lib/data/schools'
import type { School, RAGQueryParams, RAGResult, SchoolType } from '@/lib/types'
import { embedText } from '@/lib/services/embeddings'

export interface IRAGService {
  query(params: RAGQueryParams): Promise<RAGResult[]>
  getByIds(unitIds: string[]): Promise<School[]>
}

// ── In-memory fallback ────────────────────────────────────────────────────────
export class InMemoryRAGService implements IRAGService {
  async query(params: RAGQueryParams): Promise<RAGResult[]> {
    let candidates = [...SCHOOLS]

    if (params.state) {
      candidates = candidates.filter((s) => s.state === params.state)
    }

    if (params.type && params.type.length > 0) {
      candidates = candidates.filter((s) => params.type!.includes(s.type))
    }

    if (params.cipCodes && params.cipCodes.length > 0) {
      candidates = candidates.filter((s) =>
        params.cipCodes!.some((cip) =>
          s.programs.some((p) => p.startsWith(cip.substring(0, 2)))
        )
      )
    }

    if (params.maxTuition) {
      candidates = candidates.filter((s) => s.inStateTuition <= params.maxTuition!)
    }

    if (params.query) {
      const textMatches = searchSchools(params.query).map((s) => s.unitId)
      candidates = candidates.filter((s) => textMatches.includes(s.unitId))
    }

    return candidates.slice(0, 5).map((school, i) => ({
      school,
      score: 1 - i * 0.1,
    }))
  }

  async getByIds(unitIds: string[]): Promise<School[]> {
    return SCHOOLS.filter((s) => unitIds.includes(s.unitId))
  }
}

// ── Pinecone implementation ───────────────────────────────────────────────────
export class PineconeRAGService implements IRAGService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private index: any

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pinecone } = require('@pinecone-database/pinecone')
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
    this.index = pc
      .index(process.env.PINECONE_INDEX ?? 'pathwayai-schools')
      .namespace('schools')
  }

  async query(params: RAGQueryParams): Promise<RAGResult[]> {
    try {
      const queryText = params.query
        ?? [params.state, params.type?.join(' ')].filter(Boolean).join(' ')
      if (!queryText) return []

      const vector = await embedText(queryText)

      const filter: Record<string, unknown> = {}
      if (params.state) filter['state'] = { $eq: params.state }
      if (params.type && params.type.length === 1) filter['type'] = { $eq: params.type[0] }

      const res = await this.index.query({
        vector,
        topK: 5,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        includeMetadata: true,
      })

      return (res.matches ?? [])
        .filter((m: { metadata?: Record<string, unknown> }) => m.metadata)
        .map((m: { metadata: Record<string, unknown>; score?: number }) => ({
          school: metadataToSchool(m.metadata),
          score: m.score ?? 0,
        }))
    } catch (err) {
      console.error('[PineconeRAGService] query failed, returning []:', err)
      return []
    }
  }

  async getByIds(unitIds: string[]): Promise<School[]> {
    try {
      const ids = unitIds.flatMap((id) => [`ipeds_${id}`, `cds_${id}`])
      const res = await this.index.fetch(ids)
      return Object.values(res.records ?? {})
        .filter((r: unknown) => (r as { metadata?: unknown }).metadata)
        .map((r: unknown) => metadataToSchool((r as { metadata: Record<string, unknown> }).metadata))
    } catch (err) {
      console.error('[PineconeRAGService] getByIds failed, returning []:', err)
      return []
    }
  }
}

function metadataToSchool(meta: Record<string, unknown>): School {
  const satLow = Number(meta['satRangeLow'] ?? -1)
  const satHigh = Number(meta['satRangeHigh'] ?? -1)
  return {
    unitId: String(meta['unitId'] ?? ''),
    opeid: String(meta['opeid'] ?? ''),
    name: String(meta['name'] ?? ''),
    state: String(meta['state'] ?? ''),
    type: String(meta['type'] ?? 'community_college') as SchoolType,
    city: String(meta['city'] ?? ''),
    inStateTuition: Number(meta['inStateTuition'] ?? 0),
    outOfStateTuition: Number(meta['outOfStateTuition'] ?? 0),
    netPriceMedian: Number(meta['netPriceMedian'] ?? 0),
    gradRate: Number(meta['gradRate'] ?? 0),
    admissionRate: meta['admissionRate'] != null && Number(meta['admissionRate']) >= 0
      ? Number(meta['admissionRate']) : null,
    satRange: satLow > 0 && satHigh > 0 ? [satLow, satHigh] : null,
    programs: Array.isArray(meta['cipCodes']) ? (meta['cipCodes'] as string[]) : [],
    medianEarnings10yr: Number(meta['medianEarnings10yr'] ?? 0),
    medianLoanDebt: Number(meta['medianLoanDebt'] ?? 0),
    applicationDeadline: String(meta['regularDecisionDeadline'] ?? meta['applicationDeadline'] ?? ''),
    earlyDecisionDeadline: meta['earlyDecisionDeadline'] ? String(meta['earlyDecisionDeadline']) : null,
    requiresTestScore: Boolean(meta['requiresTestScore']),
    avgAidPackage: Number(meta['avgAidPackage'] ?? 0),
    pctReceivingAid: Number(meta['pctReceivingAid'] ?? 0),
    specialNotes: Array.isArray(meta['specialNotes']) ? (meta['specialNotes'] as string[]) : [],
    dataYear: Number(meta['dataYear'] ?? 2023),
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// Uses PineconeRAGService when PINECONE_API_KEY is set, falls back to in-memory.
export const ragService: IRAGService = process.env.PINECONE_API_KEY
  ? new PineconeRAGService()
  : new InMemoryRAGService()
