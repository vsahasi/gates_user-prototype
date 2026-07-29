import { describe, it, expect } from 'vitest'
import { buildUserMessage, SYSTEM_PROMPT } from '@/lib/orchestration/prompt-builder'
import { DEFAULT_PROFILE } from '@/lib/defaults'
import type { SessionState, RAGResult, IntentClassification } from '@/lib/types'
import type { ScorecardInstitution } from '@/lib/services/scorecard'
import type { ONETOccupation } from '@/lib/services/onet'
import { SCHOOLS } from '@/lib/data/schools'

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    sessionId: 'test',
    personaId: null,
    studentProfile: { ...DEFAULT_PROFILE },
    conversationHistory: [],
    priorRecommendations: [],
    createdAt: 0,
    lastActiveAt: 0,
    ...overrides,
  }
}

function makeClassification(over: Partial<IntentClassification> = {}): IntentClassification {
  return {
    intent: 'general_question',
    extractedParams: {},
    rewrittenQuery: 'What is a community college?',
    ...over,
  }
}

describe('SYSTEM_PROMPT', () => {
  it('mentions equal weighting of pathway types', () => {
    expect(SYSTEM_PROMPT).toMatch(/community college/i)
    expect(SYSTEM_PROMPT).toMatch(/trade/i)
    expect(SYSTEM_PROMPT).toMatch(/military/i)
    expect(SYSTEM_PROMPT).toMatch(/tribal/i)
    expect(SYSTEM_PROMPT).toMatch(/apprenticeship/i)
  })

  it('warns against suggesting FAFSA to DACA students in California', () => {
    expect(SYSTEM_PROMPT).toMatch(/CADAA/)
    expect(SYSTEM_PROMPT).toMatch(/DACA|undocumented/)
  })

  it('documents structured component formats', () => {
    expect(SYSTEM_PROMPT).toContain('COMPONENT:comparison_table')
    expect(SYSTEM_PROMPT).toContain('COMPONENT:pathway_cards')
    expect(SYSTEM_PROMPT).toContain('COMPONENT:timeline_checklist')
  })
})

describe('buildUserMessage', () => {
  it('omits profile block when profile is empty', () => {
    const msg = buildUserMessage({
      session: makeSession(),
      classification: makeClassification(),
      ragResults: [],
      scorecardData: [],
      onetData: [],
    })
    expect(msg).not.toContain('[STUDENT PROFILE]')
    expect(msg).toContain('[CURRENT QUESTION]')
  })

  it('includes student profile fields when present', () => {
    const session = makeSession({
      studentProfile: {
        ...DEFAULT_PROFILE,
        grade: 11,
        state: 'CA',
        gpa: 3.4,
        interests: ['nursing'],
        goals: ['RN'],
        constraints: ['childcare'],
        specialCircumstances: ['rural'],
        financialInfo: { pellEligible: true, incomeRange: null, hasParentalSupport: null },
      },
    })

    const msg = buildUserMessage({
      session,
      classification: makeClassification(),
      ragResults: [],
      scorecardData: [],
      onetData: [],
    })

    expect(msg).toContain('[STUDENT PROFILE]')
    expect(msg).toContain('Grade: 11')
    expect(msg).toContain('State: CA')
    expect(msg).toContain('GPA: 3.4')
    expect(msg).toContain('Interests: nursing')
    expect(msg).toContain('Goals: RN')
    expect(msg).toContain('Constraints: childcare')
    expect(msg).toContain('Special circumstances: rural')
    expect(msg).toContain('Pell eligible: true')
  })

  it('renders RAG results with school name and data year', () => {
    const school = SCHOOLS[0]
    const ragResults: RAGResult[] = [{ school, score: 0.9 }]
    const msg = buildUserMessage({
      session: makeSession(),
      classification: makeClassification(),
      ragResults,
      scorecardData: [],
      onetData: [],
    })
    expect(msg).toContain('[SCHOOL DATA FROM KNOWLEDGE BASE]')
    expect(msg).toContain(school.name)
    expect(msg).toContain('[Data: 2024]')
  })

  it('omits null numeric fields rather than rendering as 0/$0', () => {
    const school = {
      ...SCHOOLS[0],
      inStateTuition: null,
      gradRate: null,
      medianEarnings10yr: null,
    }
    const msg = buildUserMessage({
      session: makeSession(),
      classification: makeClassification(),
      ragResults: [{ school, score: 0.9 }],
      scorecardData: [],
      onetData: [],
    })
    expect(msg).not.toContain('$0')
    expect(msg).not.toContain('0%')
  })

  it('renders Scorecard data with admission rate label for open-admission schools', () => {
    const scorecard: ScorecardInstitution[] = [
      {
        unitId: '113364',
        name: 'City College of San Francisco',
        state: 'CA',
        inStateTuition: 1288,
        outOfStateTuition: 9528,
        admissionRate: null,
        gradRate: 0.17,
        medianEarnings10yr: 42000,
        medianDebt: 8500,
        netPrice: 1100,
      },
    ]
    const msg = buildUserMessage({
      session: makeSession(),
      classification: makeClassification(),
      ragResults: [],
      scorecardData: scorecard,
      onetData: [],
    })
    expect(msg).toContain('[COLLEGE SCORECARD DATA — Live]')
    expect(msg).toContain('Admission rate open/unknown')
  })

  it('renders O*NET career data', () => {
    const onet: ONETOccupation[] = [
      {
        code: '29-1141.00',
        title: 'Registered Nurses',
        description: '',
        jobZone: 4,
        brightOutlook: true,
        wages: { median: 86070, unit: 'annual' },
      },
    ]
    const msg = buildUserMessage({
      session: makeSession(),
      classification: makeClassification(),
      ragResults: [],
      scorecardData: [],
      onetData: onet,
    })
    expect(msg).toContain('[CAREER DATA FROM O*NET]')
    expect(msg).toContain('Registered Nurses')
    expect(msg).toContain('Job Zone 4/5')
    expect(msg).toContain('Bright Outlook')
    expect(msg).toContain('$86,070')
  })

  it('caps conversation history at last 6 turns', () => {
    const session = makeSession({
      conversationHistory: Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `msg-${i}`,
        timestamp: i,
      })),
    })
    const msg = buildUserMessage({
      session,
      classification: makeClassification(),
      ragResults: [],
      scorecardData: [],
      onetData: [],
    })
    expect(msg).toContain('msg-9')
    expect(msg).toContain('msg-4')
    expect(msg).not.toContain('msg-3')
  })

  it('uses the rewritten query as current question', () => {
    const msg = buildUserMessage({
      session: makeSession(),
      classification: makeClassification({ rewrittenQuery: 'rewritten standalone form' }),
      ragResults: [],
      scorecardData: [],
      onetData: [],
    })
    expect(msg).toContain('[CURRENT QUESTION]')
    expect(msg).toContain('rewritten standalone form')
  })
})
