// src/app/api/conversations/[conversationId]/workbench/route.ts
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params
  const body = await req.json()
  getDb()
    .prepare(`UPDATE conversations SET workbenchStateJson = ? WHERE id = ?`)
    .run(JSON.stringify(body), conversationId)
  return NextResponse.json({ ok: true })
}
