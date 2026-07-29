// src/app/api/student/[studentId]/export/route.ts
import { NextResponse } from 'next/server'
import { getDb, runMigrations } from '@/lib/db'
import {
  getStudent,
  getStudentProfile,
  listConversations,
  listMessages,
} from '@/lib/db/queries'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  await runMigrations()
  const { studentId } = await params
  const student = await getStudent(studentId)
  if (!student) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const profile = await getStudentProfile(studentId)
  const conversations = await Promise.all(
    (await listConversations(studentId)).map(async (c) => ({
      ...c,
      messages: await listMessages(c.id),
    })),
  )
  const trustEvents = await getDb().all(
    `SELECT te.* FROM trust_events te
     JOIN messages m ON m.id = te.messageId
     JOIN conversations c ON c.id = m.conversationId
     WHERE c.studentId = ?`,
    [studentId],
  )
  const bundle = {
    schemaVersion: 1,
    exportedAt: Date.now(),
    student,
    profile,
    conversations,
    trustEvents,
  }
  // displayName is user-controlled: strip everything unsafe for a header
  // (CR/LF, quotes, non-ASCII) so it can't inject headers or 500 the export.
  const safeName =
    student.displayName.replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 60) || 'student'
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="pathwayai-memory-${safeName}.json"`,
    },
  })
}
