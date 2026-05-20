// tests/orchestration/plan.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unlinkSync, existsSync } from 'node:fs'
import { closeDb, getDb, runMigrations } from '@/lib/db'
import {
  createStudent,
  createConversation,
  appendMessage,
  createSelection,
} from '@/lib/db/queries'
import { buildStudentPlan, inferPhase } from '@/lib/orchestration/plan'

const TEST_DB = './data/test-plan.db'

beforeEach(() => {
  closeDb()
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  process.env.SQLITE_PATH = TEST_DB
  runMigrations()
})
afterEach(() => {
  closeDb()
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
})

describe('inferPhase', () => {
  it('returns exploration for 0 user messages', () => {
    expect(inferPhase(0)).toBe('exploration')
  })
  it('returns exploration for 2 user messages', () => {
    expect(inferPhase(2)).toBe('exploration')
  })
  it('returns preparation for 3 user messages', () => {
    expect(inferPhase(3)).toBe('preparation')
  })
  it('returns transition for 13+ user messages', () => {
    expect(inferPhase(13)).toBe('transition')
    expect(inferPhase(100)).toBe('transition')
  })
})

describe('buildStudentPlan', () => {
  it('returns null for unknown student', () => {
    expect(buildStudentPlan('nonexistent-id')).toBeNull()
  })

  it('empty plan — no conversations, no selections', () => {
    const s = createStudent({ displayName: 'Empty Student' })
    const plan = buildStudentPlan(s.id)
    expect(plan).not.toBeNull()
    expect(plan!.studentId).toBe(s.id)
    expect(plan!.studentName).toBe('Empty Student')
    expect(plan!.currentPhase).toBe('exploration')
    expect(plan!.totalMessages).toBe(0)
    expect(plan!.conversationCount).toBe(0)
    expect(plan!.selections).toEqual([])
    expect(plan!.drafts).toEqual([])
    expect(plan!.openQuestions).toEqual([])
    expect(plan!.conversations).toEqual([])
    expect(plan!.lastActivityAt).toBeNull()
  })

  it('phase advances with messages — 6 user messages => decision', () => {
    const s = createStudent({ displayName: 'Phase Student' })
    const c = createConversation(s.id, 'Phase chat')
    for (let i = 0; i < 6; i++) {
      appendMessage({ conversationId: c.id, role: 'user', content: `message ${i + 1}` })
    }
    const plan = buildStudentPlan(s.id)
    expect(plan!.currentPhase).toBe('decision')
  })

  it('selections grouped by kind', () => {
    const s = createStudent({ displayName: 'Selection Student' })
    createSelection({
      studentId: s.id,
      kind: 'school',
      refId: 'school-1',
      refLabel: 'MIT',
    })
    createSelection({
      studentId: s.id,
      kind: 'school',
      refId: 'school-2',
      refLabel: 'Stanford',
    })
    createSelection({
      studentId: s.id,
      kind: 'pathway',
      refId: 'pathway-1',
      refLabel: 'Computer Science',
    })
    const plan = buildStudentPlan(s.id)
    expect(plan!.selections).toHaveLength(2)
    const schoolGroup = plan!.selections.find((g) => g.kind === 'school')
    const pathwayGroup = plan!.selections.find((g) => g.kind === 'pathway')
    expect(schoolGroup).toBeDefined()
    expect(schoolGroup!.items).toHaveLength(2)
    expect(pathwayGroup).toBeDefined()
    expect(pathwayGroup!.items).toHaveLength(1)
    // school comes before pathway in the ordering
    expect(plan!.selections[0].kind).toBe('school')
    expect(plan!.selections[1].kind).toBe('pathway')
  })

  it('drafts extracted from workbench state', () => {
    const s = createStudent({ displayName: 'Draft Student' })
    const c = createConversation(s.id, 'Draft chat')
    const workbench = {
      essayCommonApp: {
        prompt: 'Describe a challenge you faced.',
        draft: 'When I was fifteen, I discovered that writing could heal wounds no medicine could reach.',
      },
      fafsaForm: {
        sections: [
          { title: 'Personal Info', fields: [{ name: 'First Name', value: 'Alex' }] },
          { title: 'Financial', fields: [{ name: 'Income', value: '45000' }] },
        ],
      },
    }
    getDb().prepare('UPDATE conversations SET workbenchStateJson = ? WHERE id = ?').run(
      JSON.stringify(workbench),
      c.id,
    )
    const plan = buildStudentPlan(s.id)
    expect(plan!.drafts).toHaveLength(2)
    const essayDraft = plan!.drafts.find((d) => d.kind === 'essay_draft')
    const fafsaDraft = plan!.drafts.find((d) => d.kind === 'fafsa_draft')
    expect(essayDraft).toBeDefined()
    expect(essayDraft!.conversationId).toBe(c.id)
    expect(essayDraft!.preview).toContain('fifteen')
    expect(fafsaDraft).toBeDefined()
    expect(fafsaDraft!.preview).toBe('2 sections')
  })

  it('open questions detection', () => {
    const s = createStudent({ displayName: 'Question Student' })
    const c = createConversation(s.id, 'Questions chat')
    appendMessage({ conversationId: c.id, role: 'user', content: 'What schools are good?' })
    appendMessage({ conversationId: c.id, role: 'user', content: 'help me with FAFSA' })
    appendMessage({ conversationId: c.id, role: 'user', content: 'I just want a job' })
    const plan = buildStudentPlan(s.id)
    const questionTexts = plan!.openQuestions.map((q) => q.text)
    // First two should match; third should NOT
    expect(questionTexts.some((t) => t.includes('What schools'))).toBe(true)
    expect(questionTexts.some((t) => t.includes('help me with FAFSA'))).toBe(true)
    expect(questionTexts.some((t) => t.includes('I just want a job'))).toBe(false)
  })

  it('lastActivityAt reflects the most recent conversation', async () => {
    const s = createStudent({ displayName: 'Activity Student' })
    const c1 = createConversation(s.id, 'Old chat')
    await new Promise((r) => setTimeout(r, 5))
    const c2 = createConversation(s.id, 'New chat')
    appendMessage({ conversationId: c2.id, role: 'user', content: 'hello' })
    const plan = buildStudentPlan(s.id)
    expect(plan!.lastActivityAt).toBeGreaterThan(c1.lastMessageAt)
  })

  it('phaseProgress is 0..1 within a phase', () => {
    const s = createStudent({ displayName: 'Progress Student' })
    const c = createConversation(s.id, 'Progress chat')
    // 0 messages => exploration, at start
    const plan0 = buildStudentPlan(s.id)
    expect(plan0!.phaseProgress).toBe(0)

    // 2 user messages => exploration, max (1.0)
    appendMessage({ conversationId: c.id, role: 'user', content: 'msg 1' })
    appendMessage({ conversationId: c.id, role: 'user', content: 'msg 2' })
    const plan2 = buildStudentPlan(s.id)
    expect(plan2!.currentPhase).toBe('exploration')
    expect(plan2!.phaseProgress).toBe(1.0)
  })
})
