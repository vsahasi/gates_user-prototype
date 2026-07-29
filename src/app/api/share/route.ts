// src/app/api/share/route.ts
import { NextResponse } from 'next/server'
import { runMigrations } from '@/lib/db'
import { getStudent, issueShareToken } from '@/lib/db/queries'

const KINDS = new Set(['parent', 'counselor', 'other'])
const MIN_TTL = 60 * 60 * 1000 // 1 hour
const MAX_TTL = 90 * 24 * 60 * 60 * 1000 // 90 days
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  try {
    await runMigrations()
    const body = (await req.json().catch(() => null)) as {
      studentId?: string
      kind?: string
      ttlMs?: number
    } | null
    if (!body || typeof body.studentId !== 'string' || !KINDS.has(body.kind ?? '')) {
      return NextResponse.json(
        { error: 'studentId and kind (parent|counselor|other) are required' },
        { status: 400 },
      )
    }
    const student = await getStudent(body.studentId)
    if (!student) return NextResponse.json({ error: 'student not found' }, { status: 404 })

    const ttlMs =
      typeof body.ttlMs === 'number' && Number.isFinite(body.ttlMs)
        ? Math.min(Math.max(body.ttlMs, MIN_TTL), MAX_TTL)
        : DEFAULT_TTL

    const tok = await issueShareToken({
      studentId: body.studentId,
      kind: body.kind as 'parent' | 'counselor' | 'other',
      ttlMs,
    })
    return NextResponse.json({ token: tok.token, expiresAt: tok.expiresAt })
  } catch (err) {
    console.error('[share] failed:', err)
    return NextResponse.json({ error: 'Could not create the share link' }, { status: 500 })
  }
}
