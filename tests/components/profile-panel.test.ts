import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unlinkSync, existsSync } from 'node:fs'
import { mergeProfile } from '@/components/chat/ChatInterface'
import { getOrCreateSession, setStudentProfile, getSession } from '@/lib/orchestration/session'
import { closeDb, runMigrations } from '@/lib/db'
import { createStudent, createConversation } from '@/lib/db/queries'
import { isDirty } from '@/components/panels/ProfilePanel'

const TEST_DB = './data/test-profile-panel.db'

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

describe('setStudentProfile (DB-backed)', () => {
  beforeEach(() => {
    closeDb()
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
    process.env.SQLITE_PATH = TEST_DB
    runMigrations()
  })
  afterEach(() => {
    closeDb()
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  })

  it('replaces the session profile entirely', () => {
    const s = createStudent({ displayName: 'Alex' })
    const c = createConversation(s.id, 'First')
    getOrCreateSession(c.id, undefined, s.id)
    setStudentProfile(c.id, { grade: 11, state: 'TX', interests: ['nursing'] })
    const session = getSession(c.id)!
    expect(session.studentProfile.grade).toBe(11)
    expect(session.studentProfile.state).toBe('TX')
    expect(session.studentProfile.interests).toEqual(['nursing'])
    expect(session.studentProfile.goals).toEqual([])
  })

  it('replaces interests (does not merge with existing)', () => {
    const s = createStudent({ displayName: 'Alex' })
    const c = createConversation(s.id, 'First')
    getOrCreateSession(c.id, undefined, s.id)
    setStudentProfile(c.id, { interests: ['business', 'tech'] })
    setStudentProfile(c.id, { interests: ['nursing'] })
    const session = getSession(c.id)!
    expect(session.studentProfile.interests).toEqual(['nursing'])
  })

  it('is a no-op for unknown session', () => {
    expect(() => setStudentProfile('nonexistent', { grade: 9 })).not.toThrow()
  })
})

describe('isDirty', () => {
  const base = { grade: 10, state: 'CA', gpa: 3.5, interests: ['business'], goals: ['transfer'] }

  it('returns false when draft matches profile', () => {
    expect(isDirty({ ...base }, { ...base })).toBe(false)
  })

  it('returns true when grade differs', () => {
    expect(isDirty({ ...base, grade: 11 }, base)).toBe(true)
  })

  it('returns true when state differs', () => {
    expect(isDirty({ ...base, state: 'TX' }, base)).toBe(true)
  })

  it('returns true when gpa differs', () => {
    expect(isDirty({ ...base, gpa: 4.0 }, base)).toBe(true)
  })

  it('returns true when interests differ', () => {
    expect(isDirty({ ...base, interests: ['nursing'] }, base)).toBe(true)
  })

  it('returns true when goals differ', () => {
    expect(isDirty({ ...base, goals: [] }, base)).toBe(true)
  })

  it('returns false for null fields when both null', () => {
    expect(isDirty({ grade: null, state: null, gpa: null, interests: [], goals: [] },
                   { grade: null, state: null, gpa: null, interests: [], goals: [] })).toBe(false)
  })
})
