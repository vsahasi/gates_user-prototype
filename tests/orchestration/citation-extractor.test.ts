// tests/orchestration/citation-extractor.test.ts
import { describe, it, expect } from 'vitest'
import { extractCitations, stripCitations } from '@/lib/orchestration/citation-extractor'

describe('citation extractor', () => {
  it('pulls bracketed citations out', () => {
    const text =
      'UC Berkeley has a 14% admit rate [cite: Scorecard 2023] and tuition of $14k [cite: IPEDS 2023].'
    const cites = extractCitations(text)
    expect(cites.length).toBe(2)
    expect(cites[0].source).toBe('Scorecard 2023')
  })

  it('strip removes the markers from the visible text', () => {
    const text = 'foo [cite: A] bar [cite: B] baz'
    expect(stripCitations(text)).toBe('foo bar baz')
  })

  it('handles no citations', () => {
    expect(extractCitations('just plain text')).toEqual([])
    expect(stripCitations('just plain text')).toBe('just plain text')
  })
})
