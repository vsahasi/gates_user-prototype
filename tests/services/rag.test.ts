import { describe, it, expect, vi } from 'vitest'

// rag.ts transitively imports embeddings.ts, which constructs an OpenAI
// client at module-load time and throws when OPENAI_API_KEY is unset.
// Stub the embeddings module so tests run without API keys.
vi.mock('@/lib/services/embeddings', () => ({
  embedText: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
  embedBatch: vi.fn().mockResolvedValue([new Array(1536).fill(0)]),
}))

import { InMemoryRAGService } from '@/lib/services/rag'

const rag = new InMemoryRAGService()

describe('InMemoryRAGService.query', () => {
  it('returns up to 5 schools when no filters provided', async () => {
    const results = await rag.query({})
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(5)
    for (const r of results) {
      expect(r.school).toBeDefined()
      expect(typeof r.score).toBe('number')
    }
  })

  it('filters by state', async () => {
    const results = await rag.query({ state: 'CA' })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.school.state === 'CA')).toBe(true)
  })

  it('filters by school type', async () => {
    const results = await rag.query({ type: ['community_college'] })
    expect(results.every((r) => r.school.type === 'community_college')).toBe(true)
  })

  it('combines state and type filters', async () => {
    const results = await rag.query({ state: 'CA', type: ['4_year_public'] })
    expect(results.every((r) => r.school.state === 'CA' && r.school.type === '4_year_public')).toBe(true)
  })

  it('filters by CIP code prefix', async () => {
    const results = await rag.query({ cipCodes: ['51'] })
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r.school.programs.some((p) => p.startsWith('51'))).toBe(true)
    }
  })

  it('excludes schools without tuition data when maxTuition is set', async () => {
    const results = await rag.query({ maxTuition: 5000 })
    for (const r of results) {
      expect(r.school.inStateTuition).not.toBeNull()
      expect(r.school.inStateTuition!).toBeLessThanOrEqual(5000)
    }
  })

  it('returns empty when no schools match all filters', async () => {
    const results = await rag.query({ state: 'ZZ' })
    expect(results).toEqual([])
  })

  it('produces monotonically decreasing scores', async () => {
    const results = await rag.query({})
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThan(results[i - 1].score)
    }
  })

  it('applies free-text query against name', async () => {
    const results = await rag.query({ query: 'Davis' })
    expect(results.some((r) => r.school.name.includes('Davis'))).toBe(true)
  })
})

describe('InMemoryRAGService.getByIds', () => {
  it('returns schools matching the given unitIds', async () => {
    const schools = await rag.getByIds(['113364', '110644'])
    expect(schools.length).toBe(2)
    const ids = schools.map((s) => s.unitId).sort()
    expect(ids).toEqual(['110644', '113364'])
  })

  it('returns empty for unknown ids', async () => {
    const schools = await rag.getByIds(['999999'])
    expect(schools).toEqual([])
  })
})
