import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ONETService, createONETService } from '@/lib/services/onet'

const searchResponse = {
  occupation: [
    { code: '29-1141.00', title: 'Registered Nurses', tags: { bright_outlook: true } },
    { code: '29-2061.00', title: 'Licensed Practical Nurses', tags: { bright_outlook: false } },
  ],
}

const jobZoneResponse = { job_zone: 4 }
const wagesResponse = { annual: { median: 86070 } }
const overviewResponse = {
  title: 'Registered Nurses',
  description: 'Assess patient health problems and needs.',
  education: 'Bachelor’s degree',
  tags: { bright_outlook: true },
  also_see: [{ code: '29-1171.00', title: 'Nurse Practitioners' }],
}
const tasksResponse = {
  task: [
    { statement: 'Maintain accurate patient records' },
    { statement: 'Administer medications' },
  ],
}
const skillsResponse = {
  element: [{ name: 'Active Listening' }, { name: 'Critical Thinking' }],
}

function ok(payload: object) {
  return { ok: true, status: 200, json: async () => payload }
}

function notFound() {
  return { ok: false, status: 404, json: async () => ({}) }
}

const originalFetch = globalThis.fetch

describe('ONETService.searchOccupations', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => { globalThis.fetch = originalFetch })

  it('maps occupation[] into trimmed ONETOccupation shape', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(ok(searchResponse)) as unknown as typeof fetch
    const svc = new ONETService('test-key')
    const results = await svc.searchOccupations('nurse')
    expect(results.length).toBe(2)
    expect(results[0].title).toBe('Registered Nurses')
    expect(results[0].brightOutlook).toBe(true)
    expect(results[1].brightOutlook).toBe(false)
    expect(results[0].jobZone).toBeNull()
    expect(results[0].wages).toBeNull()
  })

  it('uses X-API-Key header for auth', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(ok(searchResponse))
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const svc = new ONETService('my-onet-key')
    await svc.searchOccupations('nurse')
    const opts = fetchSpy.mock.calls[0][1]
    expect(opts.headers['X-API-Key']).toBe('my-onet-key')
  })

  it('throws on non-OK response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch
    const svc = new ONETService('test-key')
    await expect(svc.searchOccupations('foo')).rejects.toThrow(/500/)
  })

  it('caps results at 5', async () => {
    const big = { occupation: Array.from({ length: 10 }, (_, i) => ({ code: `00-${i}`, title: `Job ${i}`, tags: {} })) }
    globalThis.fetch = vi.fn().mockResolvedValue(ok(big)) as unknown as typeof fetch
    const svc = new ONETService('test-key')
    const results = await svc.searchOccupations('any')
    expect(results.length).toBe(5)
  })
})

describe('ONETService.searchOccupationsEnriched', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => { globalThis.fetch = originalFetch })

  it('fans out to /job_zone and /wages for top results', async () => {
    const fetchSpy = vi.fn((url: string) => {
      if (url.includes('/search')) return Promise.resolve(ok(searchResponse))
      if (url.endsWith('/job_zone')) return Promise.resolve(ok(jobZoneResponse))
      if (url.endsWith('/wages')) return Promise.resolve(ok(wagesResponse))
      return Promise.resolve(notFound())
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const svc = new ONETService('test-key')
    const results = await svc.searchOccupationsEnriched('nurse', 2)
    expect(results.length).toBe(2)
    expect(results[0].jobZone).toBe(4)
    expect(results[0].wages).toEqual({ median: 86070, unit: 'annual' })
  })

  it('respects the limit parameter for fan-out count', async () => {
    const fetchSpy = vi.fn((url: string) => {
      if (url.includes('/search')) return Promise.resolve(ok(searchResponse))
      if (url.endsWith('/job_zone')) return Promise.resolve(ok(jobZoneResponse))
      if (url.endsWith('/wages')) return Promise.resolve(ok(wagesResponse))
      return Promise.resolve(notFound())
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const svc = new ONETService('test-key')
    await svc.searchOccupationsEnriched('nurse', 1)
    // 1 search + 2 sub-endpoint calls = 3 total
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('null-out wages/jobZone when sub-endpoint returns 404', async () => {
    const fetchSpy = vi.fn((url: string) => {
      if (url.includes('/search')) return Promise.resolve(ok(searchResponse))
      return Promise.resolve(notFound())
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const svc = new ONETService('test-key')
    const results = await svc.searchOccupationsEnriched('nurse', 1)
    expect(results[0].jobZone).toBeNull()
    expect(results[0].wages).toBeNull()
  })
})

describe('ONETService.getOccupationDetail', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => { globalThis.fetch = originalFetch })

  it('returns null when overview is 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(notFound()) as unknown as typeof fetch
    const svc = new ONETService('test-key')
    const result = await svc.getOccupationDetail('99-9999.00')
    expect(result).toBeNull()
  })

  it('assembles overview, job_zone, wages, tasks, skills', async () => {
    const fetchSpy = vi.fn((url: string) => {
      if (url.endsWith('29-1141.00/')) return Promise.resolve(ok(overviewResponse))
      if (url.endsWith('/job_zone')) return Promise.resolve(ok(jobZoneResponse))
      if (url.endsWith('/wages')) return Promise.resolve(ok(wagesResponse))
      if (url.endsWith('/summary/tasks')) return Promise.resolve(ok(tasksResponse))
      if (url.endsWith('/summary/skills')) return Promise.resolve(ok(skillsResponse))
      return Promise.resolve(notFound())
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const svc = new ONETService('test-key')
    const result = await svc.getOccupationDetail('29-1141.00')
    expect(result?.title).toBe('Registered Nurses')
    expect(result?.jobZone).toBe(4)
    expect(result?.wages).toEqual({ median: 86070, unit: 'annual' })
    expect(result?.tasks.length).toBe(2)
    expect(result?.skills).toEqual(['Active Listening', 'Critical Thinking'])
    expect(result?.relatedOccupations[0].title).toBe('Nurse Practitioners')
  })

  it('throws on non-404 error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch
    const svc = new ONETService('test-key')
    await expect(svc.getOccupationDetail('29-1141.00')).rejects.toThrow(/500/)
  })
})

describe('createONETService', () => {
  const original = process.env.ONET_API_KEY

  afterEach(() => {
    process.env.ONET_API_KEY = original
  })

  it('throws when API key is missing', () => {
    delete process.env.ONET_API_KEY
    expect(() => createONETService()).toThrow(/ONET_API_KEY/)
  })

  it('returns an instance when key present', () => {
    process.env.ONET_API_KEY = 'x'
    expect(createONETService()).toBeDefined()
  })
})
