// src/lib/db/queries.ts
import { nanoid } from 'nanoid'
import { getDb } from './index'
import type { StudentProfile } from '@/lib/types'
import { DEFAULT_PROFILE } from '@/lib/defaults'

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

export async function createStudent(input: {
  displayName: string
  personaId?: string
}): Promise<Student> {
  const s: Student = {
    id: nanoid(),
    displayName: input.displayName,
    personaId: input.personaId ?? null,
    createdAt: Date.now(),
  }
  await getDb().batch([
    {
      sql: `INSERT INTO students (id, displayName, personaId, createdAt) VALUES (?, ?, ?, ?)`,
      params: [s.id, s.displayName, s.personaId, s.createdAt],
    },
    {
      sql: `INSERT INTO student_profiles (studentId, profileJson, updatedAt) VALUES (?, ?, ?)`,
      params: [s.id, JSON.stringify(DEFAULT_PROFILE), s.createdAt],
    },
  ])
  return s
}

export async function listStudents(): Promise<Student[]> {
  return getDb().all<Student>(`SELECT * FROM students ORDER BY createdAt DESC`)
}

export async function getStudent(id: string): Promise<Student | undefined> {
  return getDb().get<Student>(`SELECT * FROM students WHERE id = ?`, [id])
}

export async function getStudentProfile(studentId: string): Promise<StudentProfile | null> {
  const row = await getDb().get<{ profileJson: string }>(
    `SELECT profileJson FROM student_profiles WHERE studentId = ?`,
    [studentId],
  )
  if (!row) return null
  try {
    return JSON.parse(row.profileJson) as StudentProfile
  } catch {
    return null
  }
}

export async function upsertStudentProfile(
  studentId: string,
  profile: StudentProfile,
): Promise<void> {
  // True upsert: students imported/created through older paths may lack a
  // profile row, and an UPDATE alone would silently drop the write.
  await getDb().run(
    `INSERT INTO student_profiles (studentId, profileJson, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(studentId) DO UPDATE SET profileJson = excluded.profileJson, updatedAt = excluded.updatedAt`,
    [studentId, JSON.stringify(profile), Date.now()],
  )
}

export async function createAdult(input: {
  displayName: string
  kind: 'parent' | 'counselor' | 'other'
}): Promise<Adult> {
  const a: Adult = {
    id: nanoid(),
    displayName: input.displayName,
    kind: input.kind,
    createdAt: Date.now(),
  }
  await getDb().run(
    `INSERT INTO adults (id, displayName, kind, createdAt) VALUES (?, ?, ?, ?)`,
    [a.id, a.displayName, a.kind, a.createdAt],
  )
  return a
}

export async function getAdult(id: string): Promise<Adult | undefined> {
  return getDb().get<Adult>(`SELECT * FROM adults WHERE id = ?`, [id])
}

export async function createConversation(
  studentId: string,
  title: string,
  id?: string,
): Promise<Conversation> {
  const c: Conversation = {
    id: id ?? nanoid(),
    studentId,
    title,
    phase: null,
    workbenchStateJson: null,
    lastMessageAt: Date.now(),
    createdAt: Date.now(),
  }
  await getDb().run(
    `INSERT INTO conversations (id, studentId, title, phase, workbenchStateJson, lastMessageAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [c.id, c.studentId, c.title, c.phase, c.workbenchStateJson, c.lastMessageAt, c.createdAt],
  )
  return c
}

export async function listConversations(studentId: string): Promise<Conversation[]> {
  return getDb().all<Conversation>(
    `SELECT * FROM conversations WHERE studentId = ? ORDER BY lastMessageAt DESC`,
    [studentId],
  )
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  return getDb().get<Conversation>(`SELECT * FROM conversations WHERE id = ?`, [id])
}

export async function appendMessage(input: {
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  structuredComponent?: unknown
  citations?: unknown
  signals?: unknown
  rubricScore?: unknown
}): Promise<DbMessage> {
  const m: DbMessage = {
    id: nanoid(),
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    structuredComponentJson: input.structuredComponent
      ? JSON.stringify(input.structuredComponent)
      : null,
    citationsJson: input.citations ? JSON.stringify(input.citations) : null,
    signalsJson: input.signals ? JSON.stringify(input.signals) : null,
    rubricScoreJson: input.rubricScore ? JSON.stringify(input.rubricScore) : null,
    timestamp: Date.now(),
  }
  await getDb().batch([
    {
      sql: `INSERT INTO messages
       (id, conversationId, role, content, structuredComponentJson, citationsJson, signalsJson, rubricScoreJson, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        m.id,
        m.conversationId,
        m.role,
        m.content,
        m.structuredComponentJson,
        m.citationsJson,
        m.signalsJson,
        m.rubricScoreJson,
        m.timestamp,
      ],
    },
    {
      sql: `UPDATE conversations SET lastMessageAt = ? WHERE id = ?`,
      params: [m.timestamp, m.conversationId],
    },
  ])
  return m
}

export async function listMessages(conversationId: string): Promise<DbMessage[]> {
  return getDb().all<DbMessage>(
    `SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp`,
    [conversationId],
  )
}

export async function issueShareToken(input: {
  studentId: string
  kind: 'parent' | 'counselor' | 'other'
  ttlMs: number
}): Promise<ShareToken> {
  const t: ShareToken = {
    token: nanoid(32),
    studentId: input.studentId,
    kind: input.kind,
    expiresAt: Date.now() + input.ttlMs,
    claimedByAdultId: null,
  }
  await getDb().run(
    `INSERT INTO share_tokens (token, studentId, kind, expiresAt, claimedByAdultId)
     VALUES (?, ?, ?, ?, ?)`,
    [t.token, t.studentId, t.kind, t.expiresAt, t.claimedByAdultId],
  )
  return t
}

export async function getShareToken(token: string): Promise<ShareToken | undefined> {
  return getDb().get<ShareToken>(`SELECT * FROM share_tokens WHERE token = ?`, [token])
}

export async function claimShareToken(token: string, adultId: string): Promise<Link> {
  const db = getDb()
  const tok = await db.get<ShareToken>(`SELECT * FROM share_tokens WHERE token = ?`, [token])
  if (!tok) throw new Error('Token not found')
  if (tok.claimedByAdultId) throw new Error('Token already claimed')
  if (tok.expiresAt < Date.now()) throw new Error('Token expired')

  const existing = await db.get<Link>(
    `SELECT * FROM links WHERE studentId = ? AND adultId = ?`,
    [tok.studentId, adultId],
  )

  let link: Link
  if (existing) {
    await db.batch([
      {
        sql: `UPDATE links SET status = 'active', role = ? WHERE id = ?`,
        params: [tok.kind, existing.id],
      },
      {
        sql: `UPDATE share_tokens SET claimedByAdultId = ? WHERE token = ?`,
        params: [adultId, token],
      },
    ])
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
    await db.batch([
      {
        sql: `INSERT INTO links (id, studentId, adultId, role, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [link.id, link.studentId, link.adultId, link.role, link.status, link.createdAt],
      },
      {
        sql: `UPDATE share_tokens SET claimedByAdultId = ? WHERE token = ?`,
        params: [adultId, token],
      },
    ])
  }
  return link
}

export async function listLinksForStudent(studentId: string): Promise<Link[]> {
  return getDb().all<Link>(
    `SELECT * FROM links WHERE studentId = ? ORDER BY createdAt DESC`,
    [studentId],
  )
}

export async function listLinksForAdult(adultId: string): Promise<Link[]> {
  return getDb().all<Link>(
    `SELECT * FROM links WHERE adultId = ? AND status = 'active' ORDER BY createdAt DESC`,
    [adultId],
  )
}

export async function revokeLink(studentId: string, adultId: string): Promise<void> {
  await getDb().run(
    `UPDATE links SET status = 'revoked' WHERE studentId = ? AND adultId = ?`,
    [studentId, adultId],
  )
}

// ---------------------------------------------------------------------------
// Adult conversations + messages (one conversation per adult↔student pair)
// ---------------------------------------------------------------------------

export interface AdultConversation {
  id: string
  adultId: string
  studentId: string
  lastMessageAt: number
  createdAt: number
}

export interface AdultMessage {
  id: string
  adultConvId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export async function getOrCreateAdultConversation(
  adultId: string,
  studentId: string,
): Promise<AdultConversation> {
  const db = getDb()
  const existing = await db.get<AdultConversation>(
    `SELECT * FROM adult_conversations WHERE adultId = ? AND studentId = ?`,
    [adultId, studentId],
  )
  if (existing) return existing
  const conv: AdultConversation = {
    id: nanoid(),
    adultId,
    studentId,
    lastMessageAt: Date.now(),
    createdAt: Date.now(),
  }
  await db.run(
    `INSERT INTO adult_conversations (id, adultId, studentId, lastMessageAt, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [conv.id, conv.adultId, conv.studentId, conv.lastMessageAt, conv.createdAt],
  )
  return conv
}

export async function listAdultMessages(adultConvId: string): Promise<AdultMessage[]> {
  return getDb().all<AdultMessage>(
    `SELECT * FROM adult_messages WHERE adultConvId = ? ORDER BY timestamp`,
    [adultConvId],
  )
}

export async function appendAdultMessage(input: {
  adultConvId: string
  role: AdultMessage['role']
  content: string
}): Promise<AdultMessage> {
  const m: AdultMessage = {
    id: nanoid(),
    adultConvId: input.adultConvId,
    role: input.role,
    content: input.content,
    timestamp: Date.now(),
  }
  await getDb().batch([
    {
      sql: `INSERT INTO adult_messages (id, adultConvId, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      params: [m.id, m.adultConvId, m.role, m.content, m.timestamp],
    },
    {
      sql: `UPDATE adult_conversations SET lastMessageAt = ? WHERE id = ?`,
      params: [m.timestamp, m.adultConvId],
    },
  ])
  return m
}

// ---------------------------------------------------------------------------
// Student selections
// ---------------------------------------------------------------------------

export interface StudentSelection {
  id: string
  studentId: string
  kind: 'school' | 'pathway' | 'major' | 'career'
  refId: string
  refLabel: string
  note: string | null
  stance: 'considering' | 'leaning' | 'committed'
  createdAt: number
}

export async function createSelection(input: {
  studentId: string
  kind: StudentSelection['kind']
  refId: string
  refLabel: string
  note?: string
  stance?: StudentSelection['stance']
}): Promise<StudentSelection> {
  const db = getDb()
  const existing = await db.get<StudentSelection>(
    `SELECT * FROM student_selections WHERE studentId = ? AND kind = ? AND refId = ?`,
    [input.studentId, input.kind, input.refId],
  )

  if (existing) {
    const note = input.note !== undefined ? input.note : existing.note
    const stance = input.stance ?? existing.stance
    await db.run(
      `UPDATE student_selections SET refLabel = ?, note = ?, stance = ? WHERE id = ?`,
      [input.refLabel, note, stance, existing.id],
    )
    return { ...existing, refLabel: input.refLabel, note, stance }
  }

  const sel: StudentSelection = {
    id: nanoid(),
    studentId: input.studentId,
    kind: input.kind,
    refId: input.refId,
    refLabel: input.refLabel,
    note: input.note ?? null,
    stance: input.stance ?? 'considering',
    createdAt: Date.now(),
  }
  await db.run(
    `INSERT INTO student_selections (id, studentId, kind, refId, refLabel, note, stance, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sel.id, sel.studentId, sel.kind, sel.refId, sel.refLabel, sel.note, sel.stance, sel.createdAt],
  )
  return sel
}

export async function listSelections(studentId: string): Promise<StudentSelection[]> {
  return getDb().all<StudentSelection>(
    `SELECT * FROM student_selections WHERE studentId = ? ORDER BY createdAt DESC`,
    [studentId],
  )
}

export async function getSelection(id: string): Promise<StudentSelection | undefined> {
  return getDb().get<StudentSelection>(`SELECT * FROM student_selections WHERE id = ?`, [id])
}

export async function updateSelectionStance(
  id: string,
  stance: StudentSelection['stance'],
): Promise<void> {
  await getDb().run(`UPDATE student_selections SET stance = ? WHERE id = ?`, [stance, id])
}

export async function removeSelection(id: string): Promise<void> {
  await getDb().run(`DELETE FROM student_selections WHERE id = ?`, [id])
}
