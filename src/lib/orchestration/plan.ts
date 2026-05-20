// src/lib/orchestration/plan.ts
import {
  getStudent,
  getStudentProfile,
  listConversations,
  listMessages,
  listSelections,
  type StudentSelection,
  type Conversation,
} from '@/lib/db/queries'

export type Phase = 'exploration' | 'preparation' | 'decision' | 'application' | 'transition'

export interface PlanDraft {
  conversationId: string
  conversationTitle: string
  kind: 'essay_draft' | 'fafsa_draft'
  preview: string         // first ~120 chars of the body (essay) or first field value (fafsa)
  updatedAt: number
}

export interface PlanQuestion {
  text: string
  conversationId: string
  conversationTitle: string
  at: number
}

export interface PlanSelectionGroup {
  kind: StudentSelection['kind']
  items: StudentSelection[]
}

export interface PlanConversationIndex {
  id: string
  title: string
  phase: string | null
  lastMessageAt: number
  messageCount: number
}

export interface StudentPlan {
  studentId: string
  studentName: string
  currentPhase: Phase
  phaseProgress: number              // 0..1 within the current phase
  totalMessages: number
  conversationCount: number
  selections: PlanSelectionGroup[]   // grouped by kind, only kinds with at least one item
  drafts: PlanDraft[]
  openQuestions: PlanQuestion[]
  conversations: PlanConversationIndex[]
  lastActivityAt: number | null
}

// Phase boundaries (inclusive): [min userMsgCount, max userMsgCount]
const PHASE_BOUNDS: Record<Phase, [number, number]> = {
  exploration:  [0, 2],
  preparation:  [3, 5],
  decision:     [6, 8],
  application:  [9, 12],
  transition:   [13, Infinity],
}

export function inferPhase(userMessageCount: number): Phase {
  if (userMessageCount <= 2) return 'exploration'
  if (userMessageCount <= 5) return 'preparation'
  if (userMessageCount <= 8) return 'decision'
  if (userMessageCount <= 12) return 'application'
  return 'transition'
}

function phaseProgress(phase: Phase, userMessageCount: number): number {
  const [min, max] = PHASE_BOUNDS[phase]
  if (phase === 'transition') return 1.0
  if (max === Infinity) return 1.0
  const range = max - min
  if (range === 0) return 1.0
  const offset = Math.max(0, userMessageCount - min)
  return Math.min(1, offset / range)
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n).trimEnd()
}

const KIND_ORDER: StudentSelection['kind'][] = ['school', 'pathway', 'major', 'career']

const QUESTION_RE = /\?\s*$/
const QUESTION_START_RE = /^(how|what|should|can|do i|help me)\b/i

export function buildStudentPlan(studentId: string): StudentPlan | null {
  // 1. Resolve the student
  const student = getStudent(studentId)
  if (!student) return null

  // 2. Pull all conversations + messages
  const conversations = listConversations(studentId)
  type ConvMessages = { conv: Conversation; messages: ReturnType<typeof listMessages> }
  const convMessages: ConvMessages[] = conversations.map((conv) => ({
    conv,
    messages: listMessages(conv.id),
  }))

  // 3. Aggregate counts and last activity
  let totalMessages = 0
  let lastActivityAt: number | null = null
  for (const { conv, messages } of convMessages) {
    totalMessages += messages.length
    if (lastActivityAt === null || conv.lastMessageAt > lastActivityAt) {
      lastActivityAt = conv.lastMessageAt
    }
  }

  // 4. Count user messages for phase computation
  let userMessageCount = 0
  for (const { messages } of convMessages) {
    for (const m of messages) {
      if (m.role === 'user') userMessageCount++
    }
  }

  // 5. Phase and progress
  const currentPhase = inferPhase(userMessageCount)
  const progress = phaseProgress(currentPhase, userMessageCount)

  // 6. Selections grouped by kind
  const allSelections = listSelections(studentId)
  const selectionMap = new Map<StudentSelection['kind'], StudentSelection[]>()
  for (const sel of allSelections) {
    if (!selectionMap.has(sel.kind)) selectionMap.set(sel.kind, [])
    selectionMap.get(sel.kind)!.push(sel)
  }
  const selections: PlanSelectionGroup[] = KIND_ORDER
    .filter((k) => selectionMap.has(k))
    .map((k) => ({ kind: k, items: selectionMap.get(k)! }))

  // 7. Drafts from workbenchStateJson
  const drafts: PlanDraft[] = []
  for (const { conv } of convMessages) {
    if (!conv.workbenchStateJson) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(conv.workbenchStateJson)
    } catch {
      continue
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) continue
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
      const v = value as Record<string, unknown>

      // Essay draft: has prompt (non-empty string) and draft (string)
      if (
        typeof v.prompt === 'string' && v.prompt.trim().length > 0 &&
        typeof v.draft === 'string'
      ) {
        drafts.push({
          conversationId: conv.id,
          conversationTitle: conv.title,
          kind: 'essay_draft',
          preview: truncate(v.draft.trim(), 120),
          updatedAt: conv.lastMessageAt,
        })
        continue
      }

      // FAFSA draft: has sections array of objects with fields
      if (Array.isArray(v.sections)) {
        const n = v.sections.length
        drafts.push({
          conversationId: conv.id,
          conversationTitle: conv.title,
          kind: 'fafsa_draft',
          preview: `${n} section${n !== 1 ? 's' : ''}`,
          updatedAt: conv.lastMessageAt,
        })
      }
    }
  }

  // 8. Open questions: up to 5 user messages that look like questions, most recent first
  interface ScoredMsg {
    text: string
    conversationId: string
    conversationTitle: string
    at: number
  }
  const candidateMessages: ScoredMsg[] = []
  for (const { conv, messages } of convMessages) {
    for (const m of messages) {
      if (m.role !== 'user') continue
      const text = m.content.trim()
      if (QUESTION_RE.test(text) || QUESTION_START_RE.test(text)) {
        candidateMessages.push({
          text: truncate(text, 200),
          conversationId: conv.id,
          conversationTitle: conv.title,
          at: m.timestamp,
        })
      }
    }
  }
  candidateMessages.sort((a, b) => b.at - a.at)
  const openQuestions: PlanQuestion[] = candidateMessages.slice(0, 5)

  // 9. Conversation index ordered by lastMessageAt desc
  const conversationIndex: PlanConversationIndex[] = convMessages.map(({ conv, messages }) => ({
    id: conv.id,
    title: conv.title,
    phase: conv.phase,
    lastMessageAt: conv.lastMessageAt,
    messageCount: messages.length,
  }))
  conversationIndex.sort((a, b) => b.lastMessageAt - a.lastMessageAt)

  return {
    studentId: student.id,
    studentName: student.displayName,
    currentPhase,
    phaseProgress: progress,
    totalMessages,
    conversationCount: conversations.length,
    selections,
    drafts,
    openQuestions,
    conversations: conversationIndex,
    lastActivityAt,
  }
}
