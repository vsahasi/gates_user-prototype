// src/app/api/claim/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { runMigrations } from '@/lib/db'
import { claimShareToken, createAdult, getAdult, getShareToken } from '@/lib/db/queries'

const KINDS = new Set(['parent', 'counselor', 'other'])

export async function POST(req: Request) {
  try {
    await runMigrations()
    const body = (await req.json().catch(() => null)) as {
      token?: string
      adult?:
        | { existingId: string }
        | { displayName: string; kind: 'parent' | 'counselor' | 'other' }
    } | null
    if (!body || typeof body.token !== 'string' || !body.adult || typeof body.adult !== 'object') {
      return NextResponse.json({ error: 'token and adult are required' }, { status: 400 })
    }

    // Validate the token BEFORE creating any adult row, so a bad token
    // doesn't leave an orphaned adult behind.
    const tok = await getShareToken(body.token)
    if (!tok) return NextResponse.json({ error: 'Token not found' }, { status: 404 })
    if (tok.claimedByAdultId)
      return NextResponse.json({ error: 'Token already claimed' }, { status: 400 })
    if (tok.expiresAt < Date.now())
      return NextResponse.json({ error: 'Token expired' }, { status: 400 })

    let adultId: string
    if ('existingId' in body.adult) {
      const a = await getAdult(body.adult.existingId)
      if (!a) return NextResponse.json({ error: 'adult not found' }, { status: 404 })
      adultId = a.id
    } else {
      const name =
        typeof body.adult.displayName === 'string' ? body.adult.displayName.trim() : ''
      if (!name || name.length > 100 || !KINDS.has(body.adult.kind)) {
        return NextResponse.json(
          { error: 'displayName (max 100 chars) and kind (parent|counselor|other) are required' },
          { status: 400 },
        )
      }
      const a = await createAdult({ displayName: name, kind: body.adult.kind })
      adultId = a.id
    }

    let link
    try {
      link = await claimShareToken(body.token, adultId)
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
  } catch (err) {
    console.error('[claim] failed:', err)
    return NextResponse.json({ error: 'Could not accept the invitation' }, { status: 500 })
  }
}
