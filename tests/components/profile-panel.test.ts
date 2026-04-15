import { describe, it, expect } from 'vitest'
import { mergeProfile } from '@/components/chat/ChatInterface'

describe('mergeProfile', () => {
  it('returns defaults when initial is empty', () => {
    const result = mergeProfile({})
    expect(result.grade).toBeNull()
    expect(result.state).toBeNull()
    expect(result.interests).toEqual([])
    expect(result.goals).toEqual([])
  })

  it('applies scalar fields from initial', () => {
    const result = mergeProfile({ grade: 10, state: 'CA', gpa: 3.5 })
    expect(result.grade).toBe(10)
    expect(result.state).toBe('CA')
    expect(result.gpa).toBe(3.5)
  })

  it('applies array fields from initial', () => {
    const result = mergeProfile({ interests: ['business'], goals: ['transfer to 4-year'] })
    expect(result.interests).toEqual(['business'])
    expect(result.goals).toEqual(['transfer to 4-year'])
  })

  it('does not mutate default profile across calls', () => {
    mergeProfile({ interests: ['test'] })
    const result = mergeProfile({})
    expect(result.interests).toEqual([])
  })
})
