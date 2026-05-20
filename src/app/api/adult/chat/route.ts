// src/app/api/adult/chat/route.ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  getAdult,
  getStudent,
  getStudentProfile,
  listLinksForAdult,
  getOrCreateAdultConversation,
  listAdultMessages,
  appendAdultMessage,
} from '@/lib/db/queries'
import { runMigrations } from '@/lib/db'
import { getPinnedSummary } from '@/lib/orchestration/pinned-summary'
import { currentDateDirective } from '@/lib/orchestration/prompt-builder'

export async function POST(req: Request) {
  runMigrations()
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

  // Ensure the adult↔student conversation row exists; persist the user turn.
  const conv = getOrCreateAdultConversation(adultId, studentId)
  appendAdultMessage({ adultConvId: conv.id, role: 'user', content: message })

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

  const system = `${currentDateDirective()}

You are advising the ${role} of ${student.displayName}.
You do NOT speak directly to the student; you help the adult support the student.

The student's pinned context:
${JSON.stringify(summary, null, 2)}

The student's profile:
${JSON.stringify(profile, null, 2)}

${tone}

Never invent facts about the student. If asked about something not in the profile, say so. Suggest questions the adult could ask their student rather than making decisions for them.`

  // Build full history for context. The user turn we just persisted is included
  // so the model sees its own latest instruction.
  const history = listAdultMessages(conv.id).map((m) => ({
    role: m.role === 'system' ? 'assistant' : (m.role as 'user' | 'assistant'),
    content: m.content,
  }))

  const client = new Anthropic()
  const encoder = new TextEncoder()
  let assistantText = ''

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system,
          messages: history,
        })
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            assistantText += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        // Persist the assistant turn after the stream completes.
        if (assistantText.trim()) {
          appendAdultMessage({ adultConvId: conv.id, role: 'assistant', content: assistantText })
        }
        controller.close()
      } catch (err) {
        const status = (err as { status?: number })?.status
        const overloaded = status === 529 || status === 503
        console.error(`[adult/chat] stream failed (status=${status ?? 'unknown'})`, err)
        const errorMsg = overloaded
          ? "\n\nThe advisor is briefly overloaded — try again in a minute."
          : '\n\nSomething went wrong. Please try again.'
        controller.enqueue(encoder.encode(errorMsg))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
