// src/app/api/conversations/[conversationId]/workbench/route.ts
import { NextResponse } from 'next/server'
import { getDb, runMigrations } from '@/lib/db'
import { getConversation } from '@/lib/db/queries'

const MAX_STATE_BYTES = 64 * 1024

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    await runMigrations()
    const { conversationId } = await params
    const conv = await getConversation(conversationId)
    if (!conv) return NextResponse.json({ error: 'conversation not found' }, { status: 404 })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'body must be a JSON object' }, { status: 400 })
    }
    const json = JSON.stringify(body)
    if (json.length > MAX_STATE_BYTES) {
      return NextResponse.json({ error: 'workbench state too large' }, { status: 413 })
    }
    await getDb().run(`UPDATE conversations SET workbenchStateJson = ? WHERE id = ?`, [
      json,
      conversationId,
    ])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[workbench PATCH] failed:', err)
    return NextResponse.json({ error: 'Could not save workbench state' }, { status: 500 })
  }
}
