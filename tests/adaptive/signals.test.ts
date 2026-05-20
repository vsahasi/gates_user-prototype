// tests/adaptive/signals.test.ts
import { describe, it, expect } from 'vitest'
import {
  computeReadiness,
  computeCognitiveLoad,
  computeDeadlinePressure,
} from '@/lib/adaptive/signals'
import { DEFAULT_PROFILE } from '@/lib/defaults'

describe('computeReadiness', () => {
  it('returns "exploring" when profile has no interests and message count is low', () => {
    expect(
      computeReadiness({
        messageCount: 1,
        profile: DEFAULT_PROFILE,
        intent: 'open_exploration',
      }),
    ).toBe('exploring')
  })
  it('returns "deciding" when shortlist + compare intent', () => {
    expect(
      computeReadiness({
        messageCount: 10,
        profile: { ...DEFAULT_PROFILE, interests: ['cs'] },
        intent: 'compare_options',
        shortlist: ['a', 'b', 'c'],
      }),
    ).toBe('deciding')
  })
  it('returns "acting" when deadlines + application intent', () => {
    expect(
      computeReadiness({
        messageCount: 12,
        profile: DEFAULT_PROFILE,
        intent: 'application_prep',
        deadlines: [{ id: '1', label: 'X', dueAt: Date.now() + 1_000_000 }],
      }),
    ).toBe('acting')
  })
})

describe('computeCognitiveLoad', () => {
  it('returns "high" when last 5 messages cover 4+ distinct topics', () => {
    expect(
      computeCognitiveLoad([
        { content: 'tell me about cs majors' },
        { content: 'what about nursing' },
        { content: 'do i need the SAT' },
        { content: 'is community college cheaper' },
        { content: 'help with fafsa' },
      ]),
    ).toBe('high')
  })
  it('returns "low" on focused short history', () => {
    expect(
      computeCognitiveLoad([
        { content: 'tell me about Berkeley' },
        { content: 'and the CS major there' },
      ]),
    ).toBe('low')
  })
})

describe('computeDeadlinePressure', () => {
  const now = Date.now()
  it('returns "imminent" if any deadline is < 3 days away', () => {
    expect(
      computeDeadlinePressure(
        [{ id: '1', label: 'X', dueAt: now + 2 * 24 * 60 * 60 * 1000 }],
        now,
      ),
    ).toBe('imminent')
  })
  it('returns "upcoming" if any deadline is 3-14 days away', () => {
    expect(
      computeDeadlinePressure(
        [{ id: '1', label: 'X', dueAt: now + 7 * 24 * 60 * 60 * 1000 }],
        now,
      ),
    ).toBe('upcoming')
  })
  it('returns "none" otherwise', () => {
    expect(
      computeDeadlinePressure(
        [{ id: '1', label: 'X', dueAt: now + 60 * 24 * 60 * 60 * 1000 }],
        now,
      ),
    ).toBe('none')
  })
})
