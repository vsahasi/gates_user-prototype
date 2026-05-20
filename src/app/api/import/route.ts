// src/app/api/import/route.ts
import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getDb } from '@/lib/db'

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

export async function POST(req: Request) {
  const bundle = (await req.json()) as Bundle
  if (bundle.schemaVersion !== 1) {
    return NextResponse.json({ error: 'unsupported schema' }, { status: 400 })
  }
  const db = getDb()
  const studentId = nanoid()
  const now = Date.now()
  db.exec('BEGIN')
  try {
    db.prepare(
      `INSERT INTO students (id, displayName, personaId, createdAt) VALUES (?, ?, ?, ?)`,
    ).run(studentId, bundle.student.displayName, bundle.student.personaId, now)
    db.prepare(
      `INSERT INTO student_profiles (studentId, profileJson, updatedAt) VALUES (?, ?, ?)`,
    ).run(studentId, JSON.stringify(bundle.profile ?? {}), now)
    for (const c of bundle.conversations) {
      const convId = nanoid()
      db.prepare(
        `INSERT INTO conversations (id, studentId, title, phase, lastMessageAt, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(convId, studentId, c.title, c.phase, now, now)
      for (const m of c.messages) {
        db.prepare(
          `INSERT INTO messages (id, conversationId, role, content, structuredComponentJson, citationsJson, signalsJson, rubricScoreJson, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        ).run(
          nanoid(),
          convId,
          m.role,
          m.content,
          m.structuredComponentJson ?? null,
          m.citationsJson ?? null,
          m.signalsJson ?? null,
          m.timestamp,
        )
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
  return NextResponse.json({ studentId })
}
