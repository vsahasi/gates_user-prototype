// src/app/api/chat/route.ts
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getOrCreateSession, updateSession, updateStudentProfile, setStudentProfile } from '@/lib/orchestration/session'
import { checkInputGuardrails, checkOutputGuardrails, formatDataVintageDisclosure } from '@/lib/orchestration/guardrails'
import { classifyIntent } from '@/lib/orchestration/intent'
import { buildUserMessage, SYSTEM_PROMPT } from '@/lib/orchestration/prompt-builder'
import { ragService } from '@/lib/services/rag'
import { createScorecardService } from '@/lib/services/scorecard'
import { createONETService } from '@/lib/services/onet'
import { getPersonaById } from '@/lib/data/personas'
import type { Message, StudentProfile } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const body = await request.json()
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
  if (classification.extractedParams.state) {
    updateStudentProfile(sessionId, { state: classification.extractedParams.state })
  }

  // Parallel data retrieval
  const [ragResults, scorecardData, onetData] = await Promise.allSettled([
    // RAG — always query for school context when relevant
    ['program_comparison', 'pathway_recommendation', 'application_prep'].includes(classification.intent)
      ? ragService.query({
          state: classification.extractedParams.state ?? session.studentProfile.state ?? undefined,
          cipCodes: classification.extractedParams.cipCodes,
        })
      : Promise.resolve([]),

    // Scorecard — for comparison/recommendation
    ['program_comparison', 'pathway_recommendation'].includes(classification.intent) &&
    process.env.COLLEGE_SCORECARD_API_KEY
      ? createScorecardService().searchInstitutions({
          state: classification.extractedParams.state ?? session.studentProfile.state ?? undefined,
          cipCode: classification.extractedParams.cipCodes?.[0],
          perPage: 3,
        })
      : Promise.resolve([]),

    // O*NET — for career exploration
    ['career_exploration', 'pathway_recommendation'].includes(classification.intent) &&
    process.env.ONET_USERNAME
      ? createONETService().searchOccupations(
          session.studentProfile.interests.join(' ') || message
        )
      : Promise.resolve([]),
  ])

  const rag = ragResults.status === 'fulfilled' ? ragResults.value : []
  const scorecard = scorecardData.status === 'fulfilled' ? scorecardData.value : []
  const onet = onetData.status === 'fulfilled' ? onetData.value : []

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
          max_tokens: 1500,
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
    },
  })
}
