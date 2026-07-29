import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      messages = { create: createMock }
    },
  }
})

import { classifyIntent } from '@/lib/orchestration/intent'
import { DEFAULT_PROFILE } from '@/lib/defaults'
import type { SessionState } from '@/lib/types'

function session(overrides: Partial<SessionState> = {}): SessionState {
  return {
    sessionId: 'intent-test',
    personaId: null,
    studentProfile: { ...DEFAULT_PROFILE },
    conversationHistory: [],
    priorRecommendations: [],
    createdAt: 0,
    lastActiveAt: 0,
    ...overrides,
  }
}

function mockHaikuJson(payload: object): void {
  createMock.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  })
}

function mockHaikuRaw(text: string): void {
  createMock.mockResolvedValueOnce({
    content: [{ type: 'text', text }],
  })
}

describe('classifyIntent', () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  it('parses a clean JSON response into an IntentClassification', async () => {
    mockHaikuJson({
      intent: 'program_comparison',
      extractedParams: { state: 'CA', cipCodes: ['51'] },
      rewrittenQuery: 'Compare nursing programs in California',
    })
    const result = await classifyIntent('Compare nursing programs', session())
    expect(result.intent).toBe('program_comparison')
    expect(result.extractedParams.state).toBe('CA')
    expect(result.extractedParams.cipCodes).toEqual(['51'])
    expect(result.rewrittenQuery).toContain('California')
  })

  it('strips ```json fences from model response', async () => {
    mockHaikuRaw('```json\n{"intent":"general_question","extractedParams":{},"rewrittenQuery":"hi"}\n```')
    const result = await classifyIntent('hi', session())
    expect(result.intent).toBe('general_question')
  })

  it('handles preface text before JSON via brace-balanced extraction', async () => {
    mockHaikuRaw(
      'Sure, here is the JSON:\n{"intent":"career_exploration","extractedParams":{},"rewrittenQuery":"explore careers"} done.'
    )
    const result = await classifyIntent('what jobs match my interests?', session())
    expect(result.intent).toBe('career_exploration')
  })

  it('handles nested braces in JSON values', async () => {
    mockHaikuJson({
      intent: 'profile_collection',
      extractedParams: { state: 'TX', cipCodes: [] },
      rewrittenQuery: 'I am a {senior} in Texas',
    })
    const result = await classifyIntent('I am a senior in Texas', session())
    expect(result.intent).toBe('profile_collection')
    expect(result.extractedParams.state).toBe('TX')
  })

  it('falls back to general_question on unparseable output', async () => {
    mockHaikuRaw('not json at all, just prose')
    const result = await classifyIntent('original message', session())
    expect(result.intent).toBe('general_question')
    expect(result.rewrittenQuery).toBe('original message')
  })

  it('includes session profile context in the prompt sent to Haiku', async () => {
    mockHaikuJson({ intent: 'general_question', extractedParams: {}, rewrittenQuery: 'q' })
    await classifyIntent('What are my options?', session({
      studentProfile: {
        ...DEFAULT_PROFILE,
        grade: 11,
        state: 'CA',
        interests: ['nursing'],
        specialCircumstances: ['rural'],
      },
    }))
    const call = createMock.mock.calls[0][0]
    const userContent = call.messages[0].content
    expect(userContent).toContain('Grade: 11')
    expect(userContent).toContain('State: CA')
    expect(userContent).toContain('Interests: nursing')
    expect(userContent).toContain('Special circumstances: rural')
  })

  it('summarizes empty session as "No context yet"', async () => {
    mockHaikuJson({ intent: 'general_question', extractedParams: {}, rewrittenQuery: 'q' })
    await classifyIntent('hi', session())
    const userContent = createMock.mock.calls[0][0].messages[0].content
    expect(userContent).toContain('No context yet')
  })
})
