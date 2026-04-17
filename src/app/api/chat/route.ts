// src/app/api/chat/route.ts
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getOrCreateSession, updateSession, updateStudentProfile, setStudentProfile } from '@/lib/orchestration/session'
import { checkInputGuardrails, checkOutputGuardrails, formatDataVintageDisclosure } from '@/lib/orchestration/guardrails'
import { classifyIntent } from '@/lib/orchestration/intent'
import { buildUserMessage, SYSTEM_PROMPT } from '@/lib/orchestration/prompt-builder'
import { ragService } from '@/lib/services/rag'
import { createScorecardService } from '@/lib/services/scorecard'
import { createONETService } from '@/lib/services/onet'
import { getPersonaById } from '@/lib/data/personas'
import type { IntentCategory, Message, StudentProfile } from '@/lib/types'

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
  const body = await request.json()
  // profile is client-supplied and trusted; add schema validation before production
  const { message, sessionId, personaId, profile } = body as {
    message: string
    sessionId: string
    personaId?: string
    profile?: Partial<StudentProfile>
  }

  // Input guardrails
  const inputCheck = checkInputGuardrails(message)
  if (!inputCheck.passed) {
    return Response.json({ error: inputCheck.reason }, { status: 400 })
  }

  // Session setup
  const session = getOrCreateSession(sessionId, personaId)

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
          messages: [{ role: 'user', content: userMessage }],
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

        // Save to session
        const userMsg: Message = { role: 'user', content: message, timestamp: Date.now() }
        const assistantMsg: Message = {
          role: 'assistant',
          content: outputCheck.response,
          timestamp: Date.now(),
        }

        updateSession(sessionId, {
          conversationHistory: [...session.conversationHistory, userMsg, assistantMsg],
          priorRecommendations: [
            ...session.priorRecommendations,
            ...rag.map((r) => r.school.name),
          ],
        })

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
