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

beforeEach(async () => {
  await closeDb()
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  process.env.SQLITE_PATH = TEST_DB
  await runMigrations()
})
afterEach(async () => {
  await closeDb()
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
})

describe('session.ts (DB-backed)', () => {
  it('getOrCreateSession returns existing student state', async () => {
    const s = await createStudent({ displayName: 'Alex' })
    const c = await createConversation(s.id, 'First')
    const session = await getOrCreateSession(c.id, s.personaId ?? undefined, s.id)
    expect(session.sessionId).toBe(c.id)
    expect(session.studentProfile).toBeDefined()
  })

  it('setStudentProfile writes through to db', async () => {
    const s = await createStudent({ displayName: 'Alex' })
    const c = await createConversation(s.id, 'First')
    await getOrCreateSession(c.id, undefined, s.id)
    await setStudentProfile(c.id, { gpa: 3.9 })
    const session = await getOrCreateSession(c.id, undefined, s.id)
    expect(session.studentProfile.gpa).toBe(3.9)
  })

  it('updateStudentProfile merges interests without duplicates', async () => {
    const s = await createStudent({ displayName: 'Alex' })
    const c = await createConversation(s.id, 'First')
    await getOrCreateSession(c.id, undefined, s.id)
    await updateStudentProfile(c.id, { interests: ['music'] })
    await updateStudentProfile(c.id, { interests: ['music', 'science'] })
    const session = await getOrCreateSession(c.id, undefined, s.id)
    expect(session.studentProfile.interests).toEqual(['music', 'science'])
  })
})
