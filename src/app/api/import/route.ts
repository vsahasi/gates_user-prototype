// src/app/api/import/route.ts
import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getDb, runMigrations, type DbStatement } from '@/lib/db'

interface Bundle {
  schemaVersion: number
  student: { displayName: string; personaId: string | null }
  profile: unknown
  conversations: Array<{
    title: string
    phase: string | null
    messages: Array<{
      role: string
      content: string
      timestamp: number
      structuredComponentJson?: string | null
      citationsJson?: string | null
      signalsJson?: string | null
    }>
  }>
}

const MAX_CONVERSATIONS = 200
const MAX_MESSAGES_PER_CONV = 2000
const MAX_CONTENT_CHARS = 20_000
const ROLES = new Set(['user', 'assistant', 'system'])

// The bundle is user-uploaded JSON — validate structure and cap sizes before
// writing anything, so a hand-edited file can't corrupt the DB.
function validateBundle(b: Bundle): string | null {
  if (!b.student || typeof b.student.displayName !== 'string' || !b.student.displayName.trim())
    return 'student.displayName is required'
  if (b.student.displayName.length > 100) return 'student.displayName too long'
  if (b.student.personaId !== null && typeof b.student.personaId !== 'string')
    return 'student.personaId must be a string or null'
  if (!Array.isArray(b.conversations)) return 'conversations must be an array'
  if (b.conversations.length > MAX_CONVERSATIONS) return 'too many conversations'
  for (const c of b.conversations) {
    if (typeof c.title !== 'string' || c.title.length > 300) return 'invalid conversation title'
    if (c.phase !== null && typeof c.phase !== 'string') return 'invalid conversation phase'
    if (!Array.isArray(c.messages)) return 'messages must be an array'
    if (c.messages.length > MAX_MESSAGES_PER_CONV) return 'too many messages in a conversation'
    for (const m of c.messages) {
      if (!ROLES.has(m.role)) return 'invalid message role'
      if (typeof m.content !== 'string' || m.content.length > MAX_CONTENT_CHARS)
        return 'invalid message content'
      if (typeof m.timestamp !== 'number' || !Number.isFinite(m.timestamp))
        return 'invalid message timestamp'
    }
  }
  return null
}

export async function POST(req: Request) {
  const bundle = (await req.json().catch(() => null)) as Bundle | null
  if (!bundle || bundle.schemaVersion !== 1) {
    return NextResponse.json({ error: 'unsupported schema' }, { status: 400 })
  }
  const invalid = validateBundle(bundle)
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 })
  }
  await runMigrations()
  const studentId = nanoid()
  const now = Date.now()
  const stmts: DbStatement[] = [
    {
      sql: `INSERT INTO students (id, displayName, personaId, createdAt) VALUES (?, ?, ?, ?)`,
      params: [studentId, bundle.student.displayName, bundle.student.personaId, now],
    },
    {
      sql: `INSERT INTO student_profiles (studentId, profileJson, updatedAt) VALUES (?, ?, ?)`,
      params: [studentId, JSON.stringify(bundle.profile ?? {}), now],
    },
  ]
  for (const c of bundle.conversations) {
    const convId = nanoid()
    stmts.push({
      sql: `INSERT INTO conversations (id, studentId, title, phase, lastMessageAt, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      params: [convId, studentId, c.title, c.phase, now, now],
    })
    for (const m of c.messages) {
      stmts.push({
        sql: `INSERT INTO messages (id, conversationId, role, content, structuredComponentJson, citationsJson, signalsJson, rubricScoreJson, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        params: [
          nanoid(),
          convId,
          m.role,
          m.content,
          m.structuredComponentJson ?? null,
          m.citationsJson ?? null,
          m.signalsJson ?? null,
          m.timestamp,
        ],
      })
    }
  }
  try {
    await getDb().batch(stmts)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
  return NextResponse.json({ studentId })
}
