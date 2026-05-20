// src/app/api/adult/chat/route.ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  getAdult,
  getStudent,
  getStudentProfile,
  listLinksForAdult,
} from '@/lib/db/queries'
import { getPinnedSummary } from '@/lib/orchestration/pinned-summary'

export async function POST(req: Request) {
  const { message, adultId, studentId } = (await req.json()) as {
    message: string
    adultId: string
    studentId: string
  }
  const adult = getAdult(adultId)
  const student = getStudent(studentId)
  if (!adult || !student) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const links = listLinksForAdult(adultId)
  if (!links.some((l) => l.studentId === studentId)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }

  const profile = getStudentProfile(studentId)
  const summary = getPinnedSummary(studentId)

  const role =
    adult.kind === 'counselor'
      ? 'counselor'
      : adult.kind === 'parent'
        ? 'parent or guardian'
        : 'caring adult'
  const tone =
    adult.kind === 'counselor'
      ? 'Be professional, clinical, evidence-based. Cite data when relevant.'
      : 'Be warm and coach-like. Help them ask their student the right questions.'

  const system = `You are advising the ${role} of ${student.displayName}.
You do NOT speak directly to the student; you help the adult support the student.

The student's pinned context:
${JSON.stringify(summary, null, 2)}

The student's profile:
${JSON.stringify(profile, null, 2)}

${tone}

Never invent facts about the student. If asked about something not in the profile, say so. Suggest questions the adult could ask their student rather than making decisions for them.`

  const client = new Anthropic()
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: message }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }
      controller.close()
    },
  })
  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
