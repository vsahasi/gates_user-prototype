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
    await runMigrations()
    const students = await listStudents()
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

const ADULT_KINDS = new Set(['parent', 'counselor', 'other'])

export async function POST(req: Request) {
  try {
    await runMigrations()
    const body = (await req.json()) as Body

    if (body.role !== 'student' && body.role !== 'adult') {
      return NextResponse.json({ error: 'role must be student or adult' }, { status: 400 })
    }
    if (!('existingId' in body)) {
      const name = typeof body.displayName === 'string' ? body.displayName.trim() : ''
      if (!name || name.length > 100) {
        return NextResponse.json({ error: 'displayName is required (max 100 chars)' }, { status: 400 })
      }
      body.displayName = name
      if (body.role === 'adult' && !ADULT_KINDS.has(body.kind)) {
        return NextResponse.json({ error: 'kind must be parent, counselor, or other' }, { status: 400 })
      }
    }

    let id: string
    let role: 'student' | 'adult'

    if (body.role === 'student') {
      role = 'student'
      if ('existingId' in body) {
        const s = await getStudent(body.existingId)
        if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 })
        id = s.id
      } else {
        const s = await createStudent({ displayName: body.displayName, personaId: body.personaId })
        id = s.id
      }
    } else {
      role = 'adult'
      if ('existingId' in body) {
        const a = await getAdult(body.existingId)
        if (!a) return NextResponse.json({ error: 'not found' }, { status: 404 })
        id = a.id
      } else {
        const a = await createAdult({ displayName: body.displayName, kind: body.kind })
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
    // Details stay in server logs; clients get a generic message so DB/SQL
    // internals never leak.
    console.error('[identity POST] failed:', err)
    return NextResponse.json({ error: 'Could not create identity' }, { status: 500 })
  }
}
