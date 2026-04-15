import { describe, it, expect } from 'vitest'
import { mergeProfile } from '@/components/chat/ChatInterface'
import { getOrCreateSession, setStudentProfile, getSession } from '@/lib/orchestration/session'

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

describe('setStudentProfile', () => {
  it('replaces the session profile entirely', () => {
    const sessionId = 'test-session-replace'
    getOrCreateSession(sessionId)
    setStudentProfile(sessionId, { grade: 11, state: 'TX', interests: ['nursing'] })
    const session = getSession(sessionId)!
    expect(session.studentProfile.grade).toBe(11)
    expect(session.studentProfile.state).toBe('TX')
    expect(session.studentProfile.interests).toEqual(['nursing'])
    expect(session.studentProfile.goals).toEqual([])
  })

  it('replaces interests (does not merge with existing)', () => {
    const sessionId = 'test-session-replace-interests'
    getOrCreateSession(sessionId)
    setStudentProfile(sessionId, { interests: ['business', 'tech'] })
    setStudentProfile(sessionId, { interests: ['nursing'] })
    const session = getSession(sessionId)!
    expect(session.studentProfile.interests).toEqual(['nursing'])
  })

  it('is a no-op for unknown session', () => {
    expect(() => setStudentProfile('nonexistent', { grade: 9 })).not.toThrow()
  })
})
