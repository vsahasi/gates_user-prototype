// src/app/api/student/[studentId]/conversations/route.ts
import { NextResponse } from 'next/server'
import { runMigrations } from '@/lib/db'
import { createConversation, getStudent } from '@/lib/db/queries'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    await runMigrations()
    const { studentId } = await params
    const student = await getStudent(studentId)
    if (!student) return NextResponse.json({ error: 'student not found' }, { status: 404 })
    const c = await createConversation(studentId, 'New conversation')
    return NextResponse.json({ id: c.id })
  } catch (err) {
    console.error('[conversations] failed:', err)
    return NextResponse.json({ error: 'Could not create a conversation' }, { status: 500 })
  }
}
