// tests/db/queries.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unlinkSync, existsSync } from 'node:fs'
import { closeDb, runMigrations } from '@/lib/db'
import * as q from '@/lib/db/queries'
import { DEFAULT_PROFILE } from '@/lib/defaults'

const TEST_DB = './data/test-queries.db'

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

describe('student queries', () => {
  it('creates a student with default profile', async () => {
    const s = await q.createStudent({ displayName: 'Alex', personaId: 'maria-rodriguez' })
    expect(s.id).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(s.displayName).toBe('Alex')

    const p = await q.getStudentProfile(s.id)
    expect(p).toEqual(DEFAULT_PROFILE)
  })

  it('updates student profile', async () => {
    const s = await q.createStudent({ displayName: 'Alex' })
    await q.upsertStudentProfile(s.id, { ...DEFAULT_PROFILE, gpa: 3.7 })
    const p = await q.getStudentProfile(s.id)
    expect(p?.gpa).toBe(3.7)
  })

  it('lists all students', async () => {
    await q.createStudent({ displayName: 'A' })
    await q.createStudent({ displayName: 'B' })
    const list = await q.listStudents()
    expect(list.length).toBe(2)
  })
})

describe('conversation + message queries', () => {
  it('creates a conversation and appends messages', async () => {
    const s = await q.createStudent({ displayName: 'Alex' })
    const c = await q.createConversation(s.id, 'First chat')
    const m = await q.appendMessage({
      conversationId: c.id,
      role: 'user',
      content: 'hi',
    })
    expect(m.id).toBeTruthy()
    const msgs = await q.listMessages(c.id)
    expect(msgs.length).toBe(1)
    expect(msgs[0].content).toBe('hi')
  })

  it('listConversations orders by lastMessageAt desc', async () => {
    const s = await q.createStudent({ displayName: 'Alex' })
    const c1 = await q.createConversation(s.id, 'old')
    await new Promise((r) => setTimeout(r, 5))
    const c2 = await q.createConversation(s.id, 'new')
    const list = await q.listConversations(s.id)
    expect(list.map((c) => c.id)).toEqual([c2.id, c1.id])
  })
})

describe('adult + link + share queries', () => {
  it('issues, claims, and lists share tokens', async () => {
    const s = await q.createStudent({ displayName: 'Alex' })
    const tok = await q.issueShareToken({
      studentId: s.id, kind: 'parent', ttlMs: 60_000,
    })
    expect(tok.token).toBeTruthy()

    const adult = await q.createAdult({ displayName: 'Mom', kind: 'parent' })
    const link = await q.claimShareToken(tok.token, adult.id)
    expect(link.studentId).toBe(s.id)
    expect(link.adultId).toBe(adult.id)
    expect(link.status).toBe('active')
  })

  it('claim fails on expired token', async () => {
    const s = await q.createStudent({ displayName: 'Alex' })
    const tok = await q.issueShareToken({
      studentId: s.id, kind: 'parent', ttlMs: -1,
    })
    const adult = await q.createAdult({ displayName: 'Mom', kind: 'parent' })
    await expect(q.claimShareToken(tok.token, adult.id)).rejects.toThrow(/expired/i)
  })

  it('revoking a link flips status to revoked', async () => {
    const s = await q.createStudent({ displayName: 'Alex' })
    const a = await q.createAdult({ displayName: 'Mom', kind: 'parent' })
    const tok = await q.issueShareToken({ studentId: s.id, kind: 'parent', ttlMs: 60_000 })
    await q.claimShareToken(tok.token, a.id)
    await q.revokeLink(s.id, a.id)
    const links = await q.listLinksForStudent(s.id)
    expect(links[0].status).toBe('revoked')
  })
})
