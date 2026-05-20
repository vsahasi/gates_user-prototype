// src/app/api/share/route.ts
import { NextResponse } from 'next/server'
import { issueShareToken } from '@/lib/db/queries'

export async function POST(req: Request) {
  const body = (await req.json()) as {
    studentId: string
    kind: 'parent' | 'counselor' | 'other'
    ttlMs?: number
  }
  const tok = issueShareToken({
    studentId: body.studentId,
    kind: body.kind,
    ttlMs: body.ttlMs ?? 7 * 24 * 60 * 60 * 1000,
  })
  return NextResponse.json({ token: tok.token, expiresAt: tok.expiresAt })
}
