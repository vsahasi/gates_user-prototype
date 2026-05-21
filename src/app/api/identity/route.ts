// src/app/api/identity/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { runMigrations } from '@/lib/db'
import {
  createStudent,
  createAdult,
  listStudents,
  getStudent,
  getAdult,
} from '@/lib/db/queries'

export async function GET() {
  try {
    runMigrations()
    const students = listStudents()
    return NextResponse.json({ students })
  } catch (err) {
    console.error('[identity GET] failed:', err)
    return NextResponse.json(
      { error: 'Could not load identities. Restart the dev server.' },
      { status: 500 },
    )
  }
}

type Body =
  | { role: 'student'; displayName: string; personaId?: string }
  | { role: 'student'; existingId: string }
  | { role: 'adult'; displayName: string; kind: 'parent' | 'counselor' | 'other' }
  | { role: 'adult'; existingId: string }

export async function POST(req: Request) {
  try {
    runMigrations()
    const body = (await req.json()) as Body

    let id: string
    let role: 'student' | 'adult'

    if (body.role === 'student') {
      role = 'student'
      if ('existingId' in body) {
        const s = getStudent(body.existingId)
        if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 })
        id = s.id
      } else {
        const s = createStudent({ displayName: body.displayName, personaId: body.personaId })
        id = s.id
      }
    } else {
      role = 'adult'
      if ('existingId' in body) {
        const a = getAdult(body.existingId)
        if (!a) return NextResponse.json({ error: 'not found' }, { status: 404 })
        id = a.id
      } else {
        const a = createAdult({ displayName: body.displayName, kind: body.kind })
        id = a.id
      }
    }

    const jar = await cookies()
    jar.set('pw_identity', JSON.stringify({ id, role }), {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return NextResponse.json({ id, role })
  } catch (err) {
    console.error('[identity POST] failed:', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'Could not create identity' },
      { status: 500 },
    )
  }
}
