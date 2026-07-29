// src/app/api/student/[studentId]/selections/route.ts
import { NextResponse } from 'next/server'
import { runMigrations } from '@/lib/db'
import {
  createSelection,
  listSelections,
  removeSelection,
  type StudentSelection,
} from '@/lib/db/queries'

const VALID_KINDS: StudentSelection['kind'][] = ['school', 'pathway', 'major', 'career']

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  await runMigrations()
  const { studentId } = await params
  const selections = await listSelections(studentId)
  return NextResponse.json({ selections })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  await runMigrations()
  const { studentId } = await params
  const body = await req.json()
  const { kind, refId, refLabel, note, stance } = body

  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: `kind must be one of: ${VALID_KINDS.join(', ')}` },
      { status: 400 },
    )
  }
  if (typeof refId !== 'string' || refId.trim() === '') {
    return NextResponse.json({ error: 'refId must be a non-empty string' }, { status: 400 })
  }
  if (typeof refLabel !== 'string' || refLabel.trim() === '') {
    return NextResponse.json({ error: 'refLabel must be a non-empty string' }, { status: 400 })
  }

  const selection = await createSelection({
    studentId,
    kind,
    refId,
    refLabel,
    note: note ?? undefined,
    stance: stance ?? undefined,
  })
  return NextResponse.json({ selection })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  await runMigrations()
  await params // resolve but we don't need studentId for delete-by-id
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
  }
  await removeSelection(id)
  return NextResponse.json({ ok: true })
}
