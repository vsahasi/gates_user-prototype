// src/app/api/student/[studentId]/export/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
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
  const { studentId } = await params
  const student = getStudent(studentId)
  if (!student) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const profile = getStudentProfile(studentId)
  const conversations = listConversations(studentId).map((c) => ({
    ...c,
    messages: listMessages(c.id),
  }))
  const trustEvents = getDb()
    .prepare(
      `SELECT te.* FROM trust_events te
       JOIN messages m ON m.id = te.messageId
       JOIN conversations c ON c.id = m.conversationId
       WHERE c.studentId = ?`,
    )
    .all(studentId)
  const bundle = {
    schemaVersion: 1,
    exportedAt: Date.now(),
    student,
    profile,
    conversations,
    trustEvents,
  }
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="pathwayai-memory-${student.displayName}.json"`,
    },
  })
}
