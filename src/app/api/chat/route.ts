// src/app/api/chat/route.ts
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getOrCreateSession, updateStudentProfile, setStudentProfile } from '@/lib/orchestration/session'
import { runMigrations } from '@/lib/db'
import { appendMessage, getConversation, createConversation } from '@/lib/db/queries'
import { classifyTone } from '@/lib/adaptive/tone'
import { extractCitations, stripCitations } from '@/lib/orchestration/citation-extractor'
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
import { buildUserMessage, SYSTEM_PROMPT } from '@/lib/orchestration/prompt-builder'
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

export async function POST(request: NextRequest) {
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

  // Classify intent
  const classification = await classifyIntent(message, session)

  // Adaptive signals (tone is async; the others are pure)
  const tone = await classifyTone(message)
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

  // Parallel data retrieval
  const [ragResults, scorecardData, onetData] = await Promise.allSettled([
    // RAG — always query for school context when relevant
    SCHOOL_DATA_INTENTS.has(classification.intent)
      ? ragService.query({
          state: classification.extractedParams.state ?? session.studentProfile.state ?? undefined,
          cipCodes: classification.extractedParams.cipCodes,
        })
      : Promise.resolve([]),

    // Scorecard — for comparison/recommendation
    SCORECARD_INTENTS.has(classification.intent) && process.env.COLLEGE_SCORECARD_API_KEY
      ? createScorecardService().searchInstitutions({
          state: classification.extractedParams.state ?? session.studentProfile.state ?? undefined,
          cipCode: classification.extractedParams.cipCodes?.[0],
          perPage: 3,
        })
      : Promise.resolve([]),

    // O*NET — for career exploration
    CAREER_INTENTS.has(classification.intent) && process.env.ONET_API_KEY
      ? createONETService().searchOccupationsEnriched(
          session.studentProfile.interests.join(' ') || message,
          3
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
          system: SYSTEM_PROMPT,
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

        // Citations: extract [cite: …] markers, keep them in the stored text for
        // round-trip but they were not stripped from the live stream — clients
        // tolerate the markers and render them via CitationFootnotes.
        const citations = extractCitations(outputCheck.response)
        const visibleText = stripCitations(outputCheck.response)

        // Persist assistant turn with signals + citations
        const assistantRow = appendMessage({
          conversationId: conv.id,
          role: 'assistant',
          content: visibleText,
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
        const errorMsg = '\n\n[An error occurred. Please try again.]'
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
