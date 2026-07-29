import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CollegeScorecardService, createScorecardService } from '@/lib/services/scorecard'

const sampleResult = {
  id: 110644,
  'school.name': 'UC Davis',
  'school.state': 'CA',
  'latest.cost.tuition.in_state': 14312,
  'latest.cost.tuition.out_of_state': 44066,
  'latest.admissions.admission_rate.overall': 0.39,
  'latest.completion.rate_suppressed.overall': 0.85,
  'latest.earnings.10_yrs_after_entry.median': 68000,
  'latest.aid.median_debt.completers.overall': 17200,
  'latest.cost.avg_net_price.public': 18200,
}

function mockFetchOk(payload: object) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  })
}

function mockFetchFail(status: number, body: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Error',
    text: async () => body,
    json: async () => ({}),
  })
}

const originalFetch = globalThis.fetch

describe('CollegeScorecardService.searchInstitutions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('maps API response to ScorecardInstitution shape', async () => {
    globalThis.fetch = mockFetchOk({ results: [sampleResult] }) as unknown as typeof fetch
    const svc = new CollegeScorecardService('test-key')
    const results = await svc.searchInstitutions({ state: 'CA' })
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('UC Davis')
    expect(results[0].state).toBe('CA')
    expect(results[0].inStateTuition).toBe(14312)
    expect(results[0].admissionRate).toBeCloseTo(0.39, 2)
    expect(results[0].gradRate).toBeCloseTo(0.85, 2)
  })

  it('includes api_key and state filter in query string', async () => {
    const fetchSpy = mockFetchOk({ results: [] })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const svc = new CollegeScorecardService('my-key')
    await svc.searchInstitutions({ state: 'TX', perPage: 5 })
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('api_key=my-key')
    expect(url).toContain('school.state=TX')
    expect(url).toContain('per_page=5')
  })

  it('translates 2-digit CIP prefix into a 4-digit range query', async () => {
    const fetchSpy = mockFetchOk({ results: [] })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const svc = new CollegeScorecardService('test-key')
    await svc.searchInstitutions({ cipCode: '51' })
    const url = decodeURIComponent(fetchSpy.mock.calls[0][0] as string)
    expect(url).toContain('cip_4_digit.code__range=5100..5199')
  })

  it('uses exact 4-digit CIP filter when given 4 digits', async () => {
    const fetchSpy = mockFetchOk({ results: [] })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const svc = new CollegeScorecardService('test-key')
    await svc.searchInstitutions({ cipCode: '5138' })
    const url = decodeURIComponent(fetchSpy.mock.calls[0][0] as string)
    expect(url).toContain('cip_4_digit.code=5138')
    expect(url).not.toContain('cip_4_digit.code__range')
  })

  it('uses 6-digit CIP filter when given 6 digits', async () => {
    const fetchSpy = mockFetchOk({ results: [] })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const svc = new CollegeScorecardService('test-key')
    await svc.searchInstitutions({ cipCode: '513801' })
    const url = decodeURIComponent(fetchSpy.mock.calls[0][0] as string)
    expect(url).toContain('cip_6_digit.code=513801')
  })

  it('preserves null numeric fields when API returns null', async () => {
    globalThis.fetch = mockFetchOk({
      results: [{
        ...sampleResult,
        'latest.cost.tuition.in_state': null,
        'latest.completion.rate_suppressed.overall': null,
      }],
    }) as unknown as typeof fetch
    const svc = new CollegeScorecardService('test-key')
    const results = await svc.searchInstitutions({ state: 'CA' })
    expect(results[0].inStateTuition).toBeNull()
    expect(results[0].gradRate).toBeNull()
  })

  it('throws with diagnostic body snippet on non-OK response', async () => {
    globalThis.fetch = mockFetchFail(400, '{"errors":[{"message":"bad cip"}]}') as unknown as typeof fetch
    const svc = new CollegeScorecardService('test-key')
    await expect(svc.searchInstitutions({ state: 'CA' })).rejects.toThrow(/400/)
  })
})

describe('CollegeScorecardService.getInstitution', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => { globalThis.fetch = originalFetch })

  it('returns null on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '',
      json: async () => ({}),
    }) as unknown as typeof fetch
    const svc = new CollegeScorecardService('test-key')
    const result = await svc.getInstitution('999999')
    expect(result).toBeNull()
  })

  it('maps single-result response', async () => {
    globalThis.fetch = mockFetchOk({ results: [sampleResult] }) as unknown as typeof fetch
    const svc = new CollegeScorecardService('test-key')
    const result = await svc.getInstitution('110644')
    expect(result?.name).toBe('UC Davis')
  })
})

describe('createScorecardService', () => {
  const original = process.env.COLLEGE_SCORECARD_API_KEY

  afterEach(() => {
    process.env.COLLEGE_SCORECARD_API_KEY = original
  })

  it('throws when API key is missing', () => {
    delete process.env.COLLEGE_SCORECARD_API_KEY
    expect(() => createScorecardService()).toThrow(/COLLEGE_SCORECARD_API_KEY/)
  })

  it('returns an instance when key present', () => {
    process.env.COLLEGE_SCORECARD_API_KEY = 'x'
    expect(createScorecardService()).toBeDefined()
  })
})
