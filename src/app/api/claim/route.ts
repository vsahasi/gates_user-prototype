// src/app/api/claim/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { claimShareToken, createAdult, getAdult } from '@/lib/db/queries'

export async function POST(req: Request) {
  const body = (await req.json()) as {
    token: string
    adult:
      | { existingId: string }
      | { displayName: string; kind: 'parent' | 'counselor' | 'other' }
  }
  let adultId: string
  if ('existingId' in body.adult) {
    const a = getAdult(body.adult.existingId)
    if (!a) return NextResponse.json({ error: 'adult not found' }, { status: 404 })
    adultId = a.id
  } else {
    const a = createAdult({ displayName: body.adult.displayName, kind: body.adult.kind })
    adultId = a.id
  }
  let link
  try {
    link = claimShareToken(body.token, adultId)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
  const jar = await cookies()
  jar.set('pw_identity', JSON.stringify({ id: adultId, role: 'adult' }), {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return NextResponse.json({ adultId, studentId: link.studentId })
}
