// src/app/api/student/[studentId]/conversations/route.ts
import { NextResponse } from 'next/server'
import { createConversation } from '@/lib/db/queries'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params
  const c = createConversation(studentId, 'New conversation')
  return NextResponse.json({ id: c.id })
}
