// tests/orchestration/session.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unlinkSync, existsSync } from 'node:fs'
import { closeDb, runMigrations } from '@/lib/db'
import { createStudent, createConversation } from '@/lib/db/queries'
import {
  getOrCreateSession,
  setStudentProfile,
  updateStudentProfile,
} from '@/lib/orchestration/session'

const TEST_DB = './data/test-session.db'

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

describe('session.ts (DB-backed)', () => {
  it('getOrCreateSession returns existing student state', () => {
    const s = createStudent({ displayName: 'Alex' })
    const c = createConversation(s.id, 'First')
    const session = getOrCreateSession(c.id, s.personaId ?? undefined, s.id)
    expect(session.sessionId).toBe(c.id)
    expect(session.studentProfile).toBeDefined()
  })

  it('setStudentProfile writes through to db', () => {
    const s = createStudent({ displayName: 'Alex' })
    const c = createConversation(s.id, 'First')
    getOrCreateSession(c.id, undefined, s.id)
    setStudentProfile(c.id, { gpa: 3.9 })
    const session = getOrCreateSession(c.id, undefined, s.id)
    expect(session.studentProfile.gpa).toBe(3.9)
  })

  it('updateStudentProfile merges interests without duplicates', () => {
    const s = createStudent({ displayName: 'Alex' })
    const c = createConversation(s.id, 'First')
    getOrCreateSession(c.id, undefined, s.id)
    updateStudentProfile(c.id, { interests: ['music'] })
    updateStudentProfile(c.id, { interests: ['music', 'science'] })
    const session = getOrCreateSession(c.id, undefined, s.id)
    expect(session.studentProfile.interests).toEqual(['music', 'science'])
  })
})
