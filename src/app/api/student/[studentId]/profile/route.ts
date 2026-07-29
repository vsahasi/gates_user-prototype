// src/app/api/student/[studentId]/profile/route.ts
import { NextResponse } from 'next/server'
import { runMigrations } from '@/lib/db'
import { getStudent, getStudentProfile, upsertStudentProfile } from '@/lib/db/queries'
import { StudentProfileSchema } from '@/lib/validation/student-profile'
import { DEFAULT_PROFILE } from '@/lib/defaults'
import type { StudentProfile } from '@/lib/types'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    await runMigrations()
    const { studentId } = await params
    const student = await getStudent(studentId)
    if (!student) return NextResponse.json({ error: 'student not found' }, { status: 404 })

    const body = (await req.json().catch(() => null)) as { profile?: unknown } | null
    const parsed = StudentProfileSchema.safeParse(body?.profile)
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid profile payload' }, { status: 400 })
    }

    const current = (await getStudentProfile(studentId)) ?? { ...DEFAULT_PROFILE }
    const next: StudentProfile = {
      ...current,
      ...parsed.data,
      financialInfo: { ...current.financialInfo, ...(parsed.data.financialInfo ?? {}) },
    }
    await upsertStudentProfile(studentId, next)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[profile PATCH] failed:', err)
    return NextResponse.json({ error: 'Could not save the profile' }, { status: 500 })
  }
}
