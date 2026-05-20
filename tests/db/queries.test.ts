// tests/db/queries.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unlinkSync, existsSync } from 'node:fs'
import { closeDb, runMigrations } from '@/lib/db'
import * as q from '@/lib/db/queries'
import { DEFAULT_PROFILE } from '@/lib/defaults'

const TEST_DB = './data/test-queries.db'

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

describe('student queries', () => {
  it('creates a student with default profile', () => {
    const s = q.createStudent({ displayName: 'Alex', personaId: 'maria-rodriguez' })
    expect(s.id).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(s.displayName).toBe('Alex')

    const p = q.getStudentProfile(s.id)
    expect(p).toEqual(DEFAULT_PROFILE)
  })

  it('updates student profile', () => {
    const s = q.createStudent({ displayName: 'Alex' })
    q.upsertStudentProfile(s.id, { ...DEFAULT_PROFILE, gpa: 3.7 })
    const p = q.getStudentProfile(s.id)
    expect(p?.gpa).toBe(3.7)
  })

  it('lists all students', () => {
    q.createStudent({ displayName: 'A' })
    q.createStudent({ displayName: 'B' })
    const list = q.listStudents()
    expect(list.length).toBe(2)
  })
})

describe('conversation + message queries', () => {
  it('creates a conversation and appends messages', () => {
    const s = q.createStudent({ displayName: 'Alex' })
    const c = q.createConversation(s.id, 'First chat')
    const m = q.appendMessage({
      conversationId: c.id,
      role: 'user',
      content: 'hi',
    })
    expect(m.id).toBeTruthy()
    const msgs = q.listMessages(c.id)
    expect(msgs.length).toBe(1)
    expect(msgs[0].content).toBe('hi')
  })

  it('listConversations orders by lastMessageAt desc', async () => {
    const s = q.createStudent({ displayName: 'Alex' })
    const c1 = q.createConversation(s.id, 'old')
    await new Promise((r) => setTimeout(r, 5))
    const c2 = q.createConversation(s.id, 'new')
    const list = q.listConversations(s.id)
    expect(list.map((c) => c.id)).toEqual([c2.id, c1.id])
  })
})

describe('adult + link + share queries', () => {
  it('issues, claims, and lists share tokens', () => {
    const s = q.createStudent({ displayName: 'Alex' })
    const tok = q.issueShareToken({
      studentId: s.id, kind: 'parent', ttlMs: 60_000,
    })
    expect(tok.token).toBeTruthy()

    const adult = q.createAdult({ displayName: 'Mom', kind: 'parent' })
    const link = q.claimShareToken(tok.token, adult.id)
    expect(link.studentId).toBe(s.id)
    expect(link.adultId).toBe(adult.id)
    expect(link.status).toBe('active')
  })

  it('claim fails on expired token', () => {
    const s = q.createStudent({ displayName: 'Alex' })
    const tok = q.issueShareToken({
      studentId: s.id, kind: 'parent', ttlMs: -1,
    })
    const adult = q.createAdult({ displayName: 'Mom', kind: 'parent' })
    expect(() => q.claimShareToken(tok.token, adult.id)).toThrow(/expired/i)
  })

  it('revoking a link flips status to revoked', () => {
    const s = q.createStudent({ displayName: 'Alex' })
    const a = q.createAdult({ displayName: 'Mom', kind: 'parent' })
    const tok = q.issueShareToken({ studentId: s.id, kind: 'parent', ttlMs: 60_000 })
    q.claimShareToken(tok.token, a.id)
    q.revokeLink(s.id, a.id)
    const links = q.listLinksForStudent(s.id)
    expect(links[0].status).toBe('revoked')
  })
})
