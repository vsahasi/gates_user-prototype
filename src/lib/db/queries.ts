// src/lib/db/queries.ts
import { nanoid } from 'nanoid'
import { getDb, transact } from './index'
import type { StudentProfile } from '@/lib/types'
import { DEFAULT_PROFILE } from '@/lib/defaults'

// node:sqlite returns rows with null prototypes. Next.js refuses to serialize
// those across the server/client boundary, so we clone every row through this
// helper before returning. Cheap; rows are small.
function plain<T>(row: unknown): T {
  return { ...(row as Record<string, unknown>) } as T
}
function plainAll<T>(rows: unknown[]): T[] {
  return rows.map((r) => plain<T>(r))
}

export interface Student {
  id: string
  displayName: string
  personaId: string | null
  createdAt: number
}

export interface Adult {
  id: string
  displayName: string
  kind: 'parent' | 'counselor' | 'other'
  createdAt: number
}

export interface Conversation {
  id: string
  studentId: string
  title: string
  phase: string | null
  workbenchStateJson: string | null
  lastMessageAt: number
  createdAt: number
}

export interface DbMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  structuredComponentJson: string | null
  citationsJson: string | null
  signalsJson: string | null
  rubricScoreJson: string | null
  timestamp: number
}

export interface Link {
  id: string
  studentId: string
  adultId: string
  role: string
  status: 'pending' | 'active' | 'revoked'
  createdAt: number
}

export interface ShareToken {
  token: string
  studentId: string
  kind: 'parent' | 'counselor' | 'other'
  expiresAt: number
  claimedByAdultId: string | null
}

export function createStudent(input: { displayName: string; personaId?: string }): Student {
  const s: Student = {
    id: nanoid(),
    displayName: input.displayName,
    personaId: input.personaId ?? null,
    createdAt: Date.now(),
  }
  transact(() => {
    const db = getDb()
    db.prepare(
      `INSERT INTO students (id, displayName, personaId, createdAt) VALUES (?, ?, ?, ?)`
    ).run(s.id, s.displayName, s.personaId, s.createdAt)
    db.prepare(
      `INSERT INTO student_profiles (studentId, profileJson, updatedAt) VALUES (?, ?, ?)`
    ).run(s.id, JSON.stringify(DEFAULT_PROFILE), s.createdAt)
  })
  return s
}

export function listStudents(): Student[] {
  return plainAll<Student>(
    getDb().prepare(`SELECT * FROM students ORDER BY createdAt DESC`).all(),
  )
}

export function getStudent(id: string): Student | undefined {
  const row = getDb().prepare(`SELECT * FROM students WHERE id = ?`).get(id)
  return row ? plain<Student>(row) : undefined
}

export function getStudentProfile(studentId: string): StudentProfile | null {
  const row = getDb().prepare(
    `SELECT profileJson FROM student_profiles WHERE studentId = ?`
  ).get(studentId) as { profileJson: string } | undefined
  return row ? (JSON.parse(row.profileJson) as StudentProfile) : null
}

export function upsertStudentProfile(studentId: string, profile: StudentProfile): void {
  getDb().prepare(
    `UPDATE student_profiles SET profileJson = ?, updatedAt = ? WHERE studentId = ?`
  ).run(JSON.stringify(profile), Date.now(), studentId)
}

export function createAdult(input: { displayName: string; kind: 'parent' | 'counselor' | 'other' }): Adult {
  const a: Adult = {
    id: nanoid(),
    displayName: input.displayName,
    kind: input.kind,
    createdAt: Date.now(),
  }
  getDb().prepare(
    `INSERT INTO adults (id, displayName, kind, createdAt) VALUES (?, ?, ?, ?)`
  ).run(a.id, a.displayName, a.kind, a.createdAt)
  return a
}

export function getAdult(id: string): Adult | undefined {
  const row = getDb().prepare(`SELECT * FROM adults WHERE id = ?`).get(id)
  return row ? plain<Adult>(row) : undefined
}

export function createConversation(studentId: string, title: string): Conversation {
  const c: Conversation = {
    id: nanoid(),
    studentId,
    title,
    phase: null,
    workbenchStateJson: null,
    lastMessageAt: Date.now(),
    createdAt: Date.now(),
  }
  getDb().prepare(
    `INSERT INTO conversations (id, studentId, title, phase, workbenchStateJson, lastMessageAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(c.id, c.studentId, c.title, c.phase, c.workbenchStateJson, c.lastMessageAt, c.createdAt)
  return c
}

export function listConversations(studentId: string): Conversation[] {
  return plainAll<Conversation>(
    getDb()
      .prepare(`SELECT * FROM conversations WHERE studentId = ? ORDER BY lastMessageAt DESC`)
      .all(studentId),
  )
}

export function getConversation(id: string): Conversation | undefined {
  const row = getDb().prepare(`SELECT * FROM conversations WHERE id = ?`).get(id)
  return row ? plain<Conversation>(row) : undefined
}

export function appendMessage(input: {
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  structuredComponent?: unknown
  citations?: unknown
  signals?: unknown
  rubricScore?: unknown
}): DbMessage {
  const m: DbMessage = {
    id: nanoid(),
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    structuredComponentJson: input.structuredComponent ? JSON.stringify(input.structuredComponent) : null,
    citationsJson: input.citations ? JSON.stringify(input.citations) : null,
    signalsJson: input.signals ? JSON.stringify(input.signals) : null,
    rubricScoreJson: input.rubricScore ? JSON.stringify(input.rubricScore) : null,
    timestamp: Date.now(),
  }
  transact(() => {
    const db = getDb()
    db.prepare(
      `INSERT INTO messages
       (id, conversationId, role, content, structuredComponentJson, citationsJson, signalsJson, rubricScoreJson, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      m.id, m.conversationId, m.role, m.content,
      m.structuredComponentJson, m.citationsJson, m.signalsJson, m.rubricScoreJson, m.timestamp,
    )
    db.prepare(`UPDATE conversations SET lastMessageAt = ? WHERE id = ?`).run(m.timestamp, m.conversationId)
  })
  return m
}

export function listMessages(conversationId: string): DbMessage[] {
  return plainAll<DbMessage>(
    getDb()
      .prepare(`SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp`)
      .all(conversationId),
  )
}

export function issueShareToken(input: {
  studentId: string
  kind: 'parent' | 'counselor' | 'other'
  ttlMs: number
}): ShareToken {
  const t: ShareToken = {
    token: nanoid(32),
    studentId: input.studentId,
    kind: input.kind,
    expiresAt: Date.now() + input.ttlMs,
    claimedByAdultId: null,
  }
  getDb().prepare(
    `INSERT INTO share_tokens (token, studentId, kind, expiresAt, claimedByAdultId)
     VALUES (?, ?, ?, ?, ?)`
  ).run(t.token, t.studentId, t.kind, t.expiresAt, t.claimedByAdultId)
  return t
}

export function claimShareToken(token: string, adultId: string): Link {
  const db = getDb()
  const tokRow = db.prepare(`SELECT * FROM share_tokens WHERE token = ?`).get(token)
  if (!tokRow) throw new Error('Token not found')
  const tok = plain<ShareToken>(tokRow)
  if (tok.claimedByAdultId) throw new Error('Token already claimed')
  if (tok.expiresAt < Date.now()) throw new Error('Token expired')

  const existingRow = db
    .prepare(`SELECT * FROM links WHERE studentId = ? AND adultId = ?`)
    .get(tok.studentId, adultId)
  const existing = existingRow ? plain<Link>(existingRow) : undefined

  let link: Link
  if (existing) {
    db.prepare(`UPDATE links SET status = 'active', role = ? WHERE id = ?`).run(tok.kind, existing.id)
    link = { ...existing, status: 'active', role: tok.kind }
  } else {
    link = {
      id: nanoid(),
      studentId: tok.studentId,
      adultId,
      role: tok.kind,
      status: 'active',
      createdAt: Date.now(),
    }
    db.prepare(
      `INSERT INTO links (id, studentId, adultId, role, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(link.id, link.studentId, link.adultId, link.role, link.status, link.createdAt)
  }
  db.prepare(`UPDATE share_tokens SET claimedByAdultId = ? WHERE token = ?`).run(adultId, token)
  return link
}

export function listLinksForStudent(studentId: string): Link[] {
  return plainAll<Link>(
    getDb()
      .prepare(`SELECT * FROM links WHERE studentId = ? ORDER BY createdAt DESC`)
      .all(studentId),
  )
}

export function listLinksForAdult(adultId: string): Link[] {
  return plainAll<Link>(
    getDb()
      .prepare(
        `SELECT * FROM links WHERE adultId = ? AND status = 'active' ORDER BY createdAt DESC`,
      )
      .all(adultId),
  )
}

export function revokeLink(studentId: string, adultId: string): void {
  getDb().prepare(
    `UPDATE links SET status = 'revoked' WHERE studentId = ? AND adultId = ?`
  ).run(studentId, adultId)
}
