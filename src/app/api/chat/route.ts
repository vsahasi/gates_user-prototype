// src/app/api/chat/route.ts
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getOrCreateSession, updateStudentProfile, setStudentProfile } from '@/lib/orchestration/session'
import { runMigrations } from '@/lib/db'
import { appendMessage, getConversation, createConversation } from '@/lib/db/queries'
import { classifyTone } from '@/lib/adaptive/tone'
import { extractCitations, stripCitations } from '@/lib/orchestration/citation-extractor'
import { parseStructuredComponentMessage } from '@/lib/chat/structured-component'
import { scoreAgainstRubric } from '@/lib/orchestration/rubric'
import { getDb } from '@/lib/db'
import {
  computeReadiness,
  computeCognitiveLoad,
  computeDeadlinePressure,
  type Signals,
} from '@/lib/adaptive/signals'

import { checkInputGuardrails, checkOutputGuardrails, formatDataVintageDisclosure } from '@/lib/orchestration/guardrails'
import { classifyIntent } from '@/lib/orchestration/intent'
import { buildUserMessage, systemPromptForNow } from '@/lib/orchestration/prompt-builder'
import { ragService } from '@/lib/services/rag'
import { createScorecardService } from '@/lib/services/scorecard'
import { createONETService } from '@/lib/services/onet'
import { getPersonaById } from '@/lib/data/personas'
import type { IntentCategory, StudentProfile } from '@/lib/types'

// Mirrors StudentProfile in src/lib/types.ts. All fields optional because the
// client sends a partial profile (only the fields it has collected so far).
const StudentProfileSchema = z.object({
  grade: z.number().int().min(1).max(16).nullable(),
  state: z.string().length(2).nullable(),
  interests: z.array(z.string().max(200)).max(50),
  gpa: z.number().min(0).max(5).nullable(),
  financialInfo: z.object({
    incomeRange: z.string().max(100).nullable(),
    pellEligible: z.boolean().nullable(),
    hasParentalSupport: z.boolean().nullable(),
  }),
  constraints: z.array(z.string().max(200)).max(50),
  specialCircumstances: z.array(z.string().max(200)).max(50),
  goals: z.array(z.string().max(200)).max(50),
  programInterests: z.array(z.string().max(200)).max(50),
}).partial()

const RequestBodySchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().min(1).max(200),
  personaId: z.string().max(100).optional(),
  profile: StudentProfileSchema.optional(),
})

// Which intents trigger each data source. ReadonlySet gives O(1) membership
// checks and prevents accidental typos vs. stringly-typed array literals.
const SCHOOL_DATA_INTENTS: ReadonlySet<IntentCategory> = new Set([
  'program_comparison',
  'pathway_recommendation',
  'application_prep',
])
const SCORECARD_INTENTS: ReadonlySet<IntentCategory> = new Set([
  'program_comparison',
  'pathway_recommendation',
])
const CAREER_INTENTS: ReadonlySet<IntentCategory> = new Set([
  'career_exploration',
  'pathway_recommendation',
])

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Race a promise against a wall-clock timeout. If the promise doesn't settle
 * in `ms` milliseconds, resolves to `fallback` and logs which call timed out.
 * Use this for any external API (Pinecone, Scorecard, O*NET, classifier) so
 * one slow upstream can't freeze the whole chat turn.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[chat] ${label} timed out after ${ms}ms — falling back`)
      resolve(fallback)
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        console.warn(`[chat] ${label} threw — falling back:`, (err as Error)?.message ?? err)
        resolve(fallback)
      },
    )
  })
}

export async function POST(request: NextRequest) {
  try {
    return await handle(request)
  } catch (err) {
    // Pre-stream errors (DB hiccups, JSON parse, etc.) — return a useful
    // streaming response so the browser doesn't just see a silent 500.
    console.error('[chat] handler failed before stream:', err)
    const encoder = new TextEncoder()
    const errorMsg =
      'Something went wrong setting up that turn. Try refreshing the page (Cmd+Shift+R) and sending it again.'
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(errorMsg))
          controller.close()
        },
      }),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
  }
}

async function handle(request: NextRequest) {
  runMigrations()
  const body = await request.json()
  // profile is client-supplied and trusted; add schema validation before production
  const { message, sessionId, personaId, profile, studentId, workbenchState } = body as {
    message: string
    sessionId: string
    personaId?: string
    profile?: Partial<StudentProfile>
    studentId?: string
    workbenchState?: Record<string, unknown>
  }

  // Input guardrails
  const inputCheck = checkInputGuardrails(message)
  if (!inputCheck.passed) {
    return Response.json({ error: inputCheck.reason }, { status: 400 })
  }

  // Ensure conversation exists (sessionId is treated as conversationId)
  let conv = getConversation(sessionId)
  if (!conv) {
    if (!studentId) {
      return Response.json({ error: 'studentId required for new conversation' }, { status: 400 })
    }
    conv = createConversation(studentId, 'New conversation')
  }

  // Session setup (now DB-backed)
  const session = getOrCreateSession(conv.id, personaId, conv.studentId)

  // Persist user turn immediately so it survives errors mid-stream.
  appendMessage({ conversationId: conv.id, role: 'user', content: message })

  // Apply client-provided profile (authoritative) or seed from persona on first message
  if (profile) {
    setStudentProfile(sessionId, profile)
  } else if (personaId && session.conversationHistory.length === 0) {
    const persona = getPersonaById(personaId)
    if (persona?.initialProfile) {
      updateStudentProfile(sessionId, persona.initialProfile as Parameters<typeof updateStudentProfile>[1])
    }
  }

  // Classify intent — 15s budget; falls back to general_question on timeout/error
  const classification = await withTimeout(
    classifyIntent(message, session),
    15_000,
    'classifyIntent',
    { intent: 'general_question' as IntentCategory, extractedParams: {}, rewrittenQuery: message },
  )

  // Adaptive signals — tone has its own try/catch already, but cap it too
  const tone = await withTimeout(classifyTone(message), 8_000, 'classifyTone', 'calm' as const)
  const signals: Signals = {
    tone,
    readiness: computeReadiness({
      messageCount: session.conversationHistory.length,
      profile: session.studentProfile,
      intent: classification.intent,
    }),
    cognitiveLoad: computeCognitiveLoad(
      session.conversationHistory
        .filter((m) => m.role === 'user')
        .map((m) => ({ content: m.content })),
    ),
    deadlinePressure: computeDeadlinePressure([]),
  }

  // Update profile with extracted params
  if (!profile && classification.extractedParams.state) {
    updateStudentProfile(sessionId, { state: classification.extractedParams.state })
  }

  // Parallel data retrieval — each external call has its own 12-15s budget so
  // a slow Pinecone or Scorecard can't hold the whole turn.
  const [ragResults, scorecardData, onetData] = await Promise.allSettled([
    SCHOOL_DATA_INTENTS.has(classification.intent)
      ? withTimeout(
          ragService.query({
            state: classification.extractedParams.state ?? session.studentProfile.state ?? undefined,
            cipCodes: classification.extractedParams.cipCodes,
          }),
          12_000,
          'rag.query',
          [],
        )
      : Promise.resolve([]),

    SCORECARD_INTENTS.has(classification.intent) && process.env.COLLEGE_SCORECARD_API_KEY
      ? withTimeout(
          createScorecardService().searchInstitutions({
            state: classification.extractedParams.state ?? session.studentProfile.state ?? undefined,
            cipCode: classification.extractedParams.cipCodes?.[0],
            perPage: 3,
          }),
          15_000,
          'scorecard.searchInstitutions',
          [],
        )
      : Promise.resolve([]),

    CAREER_INTENTS.has(classification.intent) && process.env.ONET_API_KEY
      ? withTimeout(
          createONETService().searchOccupationsEnriched(
            session.studentProfile.interests.join(' ') || message,
            3,
          ),
          15_000,
          'onet.searchOccupationsEnriched',
          [],
        )
      : Promise.resolve([]),
  ])

  const rag = ragResults.status === 'fulfilled' ? ragResults.value : []
  const scorecard = scorecardData.status === 'fulfilled' ? scorecardData.value : []
  const onet = onetData.status === 'fulfilled' ? onetData.value : []

  // Raw reasons can contain CRLF (from Error stacks) and sensitive details —
  // keep them in server logs only, and expose just an ok/error status to the client.
  const ragReason = ragResults.status === 'rejected' ? String(ragResults.reason) : ''
  const scorecardReason = scorecardData.status === 'rejected' ? String(scorecardData.reason) : ''
  const onetReason = onetData.status === 'rejected' ? String(onetData.reason) : ''

  console.log(
    `[chat] intent=${classification.intent} rag=${rag.length} scorecard=${scorecard.length} onet=${onet.length}` +
      (ragReason ? ` rag_err=${ragReason}` : '') +
      (scorecardReason ? ` scorecard_err=${scorecardReason}` : '') +
      (onetReason ? ` onet_err=${onetReason}` : '')
  )

  // Build prompt
  const userMessage = buildUserMessage({
    session,
    classification,
    ragResults: rag,
    scorecardData: scorecard,
    onetData: onet,
  })

  const workbenchSnippet =
    workbenchState && Object.keys(workbenchState).length > 0
      ? `\n\nCURRENT WORKBENCH STATE (the student has been interacting with these panels):\n${JSON.stringify(workbenchState, null, 2)}\nReference this when relevant.`
      : ''

  // Stream from Claude
  const encoder = new TextEncoder()
  let fullResponse = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2500,
          system: systemPromptForNow(),
          messages: [{ role: 'user', content: userMessage + workbenchSnippet }],
        })

        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullResponse += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }

        // Add vintage disclosure if school data was used
        if (rag.length > 0) {
          const disclosure = formatDataVintageDisclosure(2024)
          fullResponse += disclosure
          controller.enqueue(encoder.encode(disclosure))
        }

        // Output guardrails
        const retrievedDataStr = JSON.stringify({ rag, scorecard, onet })
        const outputCheck = checkOutputGuardrails(fullResponse, retrievedDataStr)

        // Strip COMPONENT markers from the persisted text; the parsed component
        // is stored alongside as structuredComponentJson so reloads can re-render it.
        const parsed = parseStructuredComponentMessage(outputCheck.response)
        const citations = extractCitations(parsed.cleanText)
        const visibleText = stripCitations(parsed.cleanText)

        // Persist assistant turn with structured component + signals + citations
        const assistantRow = appendMessage({
          conversationId: conv.id,
          role: 'assistant',
          content: visibleText,
          structuredComponent: parsed.component ?? undefined,
          signals,
          citations: citations.length > 0 ? citations : undefined,
        })

        // Async rubric scoring — does not block the response.
        if (visibleText.length > 80) {
          ;(async () => {
            try {
              const score = await scoreAgainstRubric({
                userMessage: message,
                assistantResponse: visibleText,
              })
              if (score) {
                getDb()
                  .prepare(`UPDATE messages SET rubricScoreJson = ? WHERE id = ?`)
                  .run(JSON.stringify(score), assistantRow.id)
              }
            } catch {
              // Rubric scoring is best-effort.
            }
          })()
        }

        controller.close()
      } catch (err) {
        const status = (err as { status?: number })?.status
        const overloaded = status === 529 || status === 503
        console.error(`[chat] stream failed (status=${status ?? 'unknown'})`, err)
        const errorMsg = overloaded
          ? "\n\nThe advisor is briefly overloaded right now — that's on us, not you. Give it a minute and send the message again."
          : '\n\nSomething went wrong on our end. Please try again in a moment.'
        controller.enqueue(encoder.encode(errorMsg))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Intent': classification.intent,
      'X-RAG-Count': String(rag.length),
      'X-Scorecard-Count': String(scorecard.length),
      'X-ONET-Count': String(onet.length),
      'X-RAG-Status': ragResults.status === 'fulfilled' ? 'ok' : 'error',
      'X-Scorecard-Status': scorecardData.status === 'fulfilled' ? 'ok' : 'error',
      'X-ONET-Status': onetData.status === 'fulfilled' ? 'ok' : 'error',
    },
  })
}
