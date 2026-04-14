// src/lib/orchestration/intent.ts
import Anthropic from '@anthropic-ai/sdk'
import type { IntentClassification, SessionState } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a college advising tool. Classify the student's message into exactly one intent and extract structured parameters.

Intents:
- profile_collection: Student is sharing personal info (grade, interests, location, finances, circumstances)
- career_exploration: Student is exploring career options or expressing interests
- program_comparison: Student wants to compare specific schools or programs
- pathway_recommendation: Student wants personalized postsecondary pathway recommendations
- application_prep: Student needs help with applications, deadlines, FAFSA, CADAA, or financial aid
- general_question: General advising question not fitting above categories

Respond with ONLY valid JSON matching this schema:
{
  "intent": "<intent_category>",
  "extractedParams": {
    "state": "<2-letter state code or null>",
    "cipCodes": ["<CIP prefix>"] or [],
    "schoolNames": ["<school name>"] or [],
    "degreeLevel": "associate|bachelor|certificate|trade|null",
    "maxBudget": <number or null>
  },
  "rewrittenQuery": "<clear, standalone version of the query using session context>"
}`

export async function classifyIntent(
  message: string,
  session: SessionState
): Promise<IntentClassification> {
  const contextSummary = buildContextSummary(session)

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: INTENT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Session context:\n${contextSummary}\n\nStudent message: "${message}"`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'

  try {
    return JSON.parse(text) as IntentClassification
  } catch {
    // Fallback if JSON parsing fails
    return {
      intent: 'general_question',
      extractedParams: {},
      rewrittenQuery: message,
    }
  }
}

function buildContextSummary(session: SessionState): string {
  const p = session.studentProfile
  const parts: string[] = []
  if (p.grade) parts.push(`Grade: ${p.grade}`)
  if (p.state) parts.push(`State: ${p.state}`)
  if (p.interests.length) parts.push(`Interests: ${p.interests.join(', ')}`)
  if (p.goals.length) parts.push(`Goals: ${p.goals.join(', ')}`)
  if (p.specialCircumstances.length) parts.push(`Special circumstances: ${p.specialCircumstances.join(', ')}`)
  if (p.constraints.length) parts.push(`Constraints: ${p.constraints.join(', ')}`)
  if (session.priorRecommendations.length)
    parts.push(`Previously mentioned: ${session.priorRecommendations.join(', ')}`)
  return parts.length ? parts.join('\n') : 'No context yet'
}
