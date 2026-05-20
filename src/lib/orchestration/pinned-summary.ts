// src/lib/orchestration/pinned-summary.ts
import { getDb } from '@/lib/db'
import {
  getStudent,
  getStudentProfile,
  listConversations,
  listMessages,
  type Conversation,
} from '@/lib/db/queries'

export interface RecentExchange {
  conversationTitle: string
  studentTurn: string
  assistantTurn: string
  at: number
}

export interface PinnedSummary {
  interests: string[]
  goals: string[]
  programInterests: string[]
  constraints: string[]
  grade: number | null
  state: string | null
  currentPhase: string | null
  openQuestions: string[]
  recentExchanges: RecentExchange[]
  conversations: Array<{ id: string; title: string; lastMessageAt: number; messageCount: number }>
  summary: string
  generatedAt: number
}

// Cache lifetime — short enough that a parent visiting right after their kid
// chats sees the new context, long enough to avoid recomputing every page load.
const STALE_MS = 5 * 60 * 1000

export function getPinnedSummary(studentId: string): PinnedSummary | null {
  const s = getStudent(studentId)
  if (!s) return null
  type StudentRow = { pinnedSummaryJson?: string | null; summaryUpdatedAt?: number | null }
  const row = s as unknown as StudentRow
  if (
    row.pinnedSummaryJson &&
    row.summaryUpdatedAt &&
    Date.now() - row.summaryUpdatedAt < STALE_MS
  ) {
    const cached = JSON.parse(row.pinnedSummaryJson) as Partial<PinnedSummary>
    // Cache from an older schema — recompute. (`recentExchanges` was added in
    // the bug-fix pass; treat its absence as the version sentinel.)
    if (!Array.isArray(cached.recentExchanges)) {
      return refreshPinnedSummary(studentId)
    }
    return cached as PinnedSummary
  }
  return refreshPinnedSummary(studentId)
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1).trimEnd() + '…'
}

export function refreshPinnedSummary(studentId: string): PinnedSummary {
  const profile = getStudentProfile(studentId)
  const convs = listConversations(studentId)

  // Build conversation index with message counts (cheap; 1 query per conv)
  const convMeta = convs.map((c: Conversation) => {
    const msgs = listMessages(c.id)
    return { conv: c, msgs }
  })

  // Pull the most recent 3 user→assistant exchange pairs across all conversations.
  const exchanges: RecentExchange[] = []
  for (const { conv, msgs } of convMeta) {
    for (let i = msgs.length - 1; i >= 0 && exchanges.length < 6; i--) {
      const m = msgs[i]
      if (m.role !== 'assistant') continue
      const prev = i > 0 ? msgs[i - 1] : null
      if (!prev || prev.role !== 'user') continue
      exchanges.push({
        conversationTitle: conv.title,
        studentTurn: truncate(prev.content, 240),
        assistantTurn: truncate(m.content, 240),
        at: m.timestamp,
      })
    }
  }
  exchanges.sort((a, b) => b.at - a.at)
  const recentExchanges = exchanges.slice(0, 3)

  // Open-ish questions: any recent user message that's short + ends with ? OR starts
  // with how/what/should — broader than "literally contains ?".
  const openQuestionRe = /\?\s*$|^(how|what|should|can|do i|help me)\b/i
  const openQuestions: string[] = []
  for (const { msgs } of convMeta) {
    for (let i = msgs.length - 1; i >= 0 && openQuestions.length < 3; i--) {
      const m = msgs[i]
      if (m.role !== 'user') continue
      if (openQuestionRe.test(m.content)) openQuestions.push(truncate(m.content, 200))
    }
  }

  const summary: PinnedSummary = {
    interests: profile?.interests ?? [],
    goals: profile?.goals ?? [],
    programInterests: profile?.programInterests ?? [],
    constraints: profile?.constraints ?? [],
    grade: profile?.grade ?? null,
    state: profile?.state ?? null,
    currentPhase: convs[0]?.phase ?? null,
    openQuestions,
    recentExchanges,
    conversations: convMeta.map(({ conv, msgs }) => ({
      id: conv.id,
      title: conv.title,
      lastMessageAt: conv.lastMessageAt,
      messageCount: msgs.length,
    })),
    summary: convs[0]
      ? `${convMeta.reduce((s, c) => s + c.msgs.length, 0)} messages across ${convs.length} conversation${convs.length === 1 ? '' : 's'}. Last active ${new Date(convs[0].lastMessageAt).toLocaleString()}.`
      : 'No conversations yet.',
    generatedAt: Date.now(),
  }
  getDb()
    .prepare(`UPDATE students SET pinnedSummaryJson = ?, summaryUpdatedAt = ? WHERE id = ?`)
    .run(JSON.stringify(summary), summary.generatedAt, studentId)
  return summary
}
