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

// Streaming turn; allow well past the platform default so long answers
// aren't cut off on Vercel.
export const maxDuration = 300

export async function POST(req: Request) {
  await runMigrations()
  const body = (await req.json().catch(() => null)) as {
    message?: unknown
    adultId?: unknown
    studentId?: unknown
  } | null
  const { message, adultId, studentId } = body ?? {}
  if (
    typeof message !== 'string' || !message.trim() || message.length > 4000 ||
    typeof adultId !== 'string' || typeof studentId !== 'string'
  ) {
    return NextResponse.json(
      { error: 'message (1-4000 chars), adultId, and studentId are required' },
      { status: 400 },
    )
  }
  const adult = await getAdult(adultId)
  const student = await getStudent(studentId)
  if (!adult || !student) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const links = await listLinksForAdult(adultId)
  if (!links.some((l) => l.studentId === studentId)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }

  // Ensure the adult↔student conversation row exists; persist the user turn.
  const conv = await getOrCreateAdultConversation(adultId, studentId)
  await appendAdultMessage({ adultConvId: conv.id, role: 'user', content: message })

  const profile = await getStudentProfile(studentId)
  const summary = await getPinnedSummary(studentId)

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
  const history = (await listAdultMessages(conv.id)).map((m) => ({
    role: m.role === 'system' ? 'assistant' : (m.role as 'user' | 'assistant'),
    content: m.content,
  }))

  const client = new Anthropic()
  const encoder = new TextEncoder()
  let assistantText = ''

  const readable = new ReadableStream({
    async start(controller) {
      // Client disconnects make enqueue/close throw — swallow those so the
      // assistant turn still gets persisted.
      let clientGone = false
      const safeEnqueue = (chunk: Uint8Array) => {
        if (clientGone) return
        try {
          controller.enqueue(chunk)
        } catch {
          clientGone = true
        }
      }
      const safeClose = () => {
        if (clientGone) return
        clientGone = true
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
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
            safeEnqueue(encoder.encode(event.delta.text))
          }
        }
        // Persist the assistant turn after the stream completes.
        if (assistantText.trim()) {
          await appendAdultMessage({ adultConvId: conv.id, role: 'assistant', content: assistantText })
        }
        safeClose()
      } catch (err) {
        const status = (err as { status?: number })?.status
        const overloaded = status === 529 || status === 503
        console.error(`[adult/chat] stream failed (status=${status ?? 'unknown'})`, err)
        const errorMsg = overloaded
          ? "\n\nThe advisor is briefly overloaded — try again in a minute."
          : '\n\nSomething went wrong. Please try again.'
        safeEnqueue(encoder.encode(errorMsg))
        safeClose()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
