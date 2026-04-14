// src/lib/services/rag.ts
import { SCHOOLS, searchSchools } from '@/lib/data/schools'
import type { School, RAGQueryParams, RAGResult } from '@/lib/types'

export interface IRAGService {
  query(params: RAGQueryParams): Promise<RAGResult[]>
  getByIds(unitIds: string[]): Promise<School[]>
}

// In-memory implementation — replace with PineconeRAGService for production
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

// Singleton for use in API routes
export const ragService: IRAGService = new InMemoryRAGService()
