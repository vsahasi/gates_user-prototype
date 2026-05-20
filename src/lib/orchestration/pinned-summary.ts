// src/lib/orchestration/pinned-summary.ts
import { getDb } from '@/lib/db'
import {
  getStudent,
  getStudentProfile,
  listConversations,
  listMessages,
} from '@/lib/db/queries'

export interface PinnedSummary {
  interests: string[]
  goals: string[]
  programInterests: string[]
  currentPhase: string | null
  openQuestions: string[]
  summary: string
  generatedAt: number
}

const STALE_MS = 24 * 60 * 60 * 1000

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
    return JSON.parse(row.pinnedSummaryJson) as PinnedSummary
  }
  return refreshPinnedSummary(studentId)
}

export function refreshPinnedSummary(studentId: string): PinnedSummary {
  const profile = getStudentProfile(studentId)
  const convs = listConversations(studentId)
  const recentMessages = convs[0] ? listMessages(convs[0].id).slice(-10) : []

  const summary: PinnedSummary = {
    interests: profile?.interests ?? [],
    goals: profile?.goals ?? [],
    programInterests: profile?.programInterests ?? [],
    currentPhase: convs[0]?.phase ?? null,
    openQuestions: recentMessages
      .filter((m) => m.role === 'user' && m.content.includes('?'))
      .slice(-3)
      .map((m) => m.content),
    summary: convs[0]
      ? `${recentMessages.length} recent messages in "${convs[0].title}". Last active ${new Date(convs[0].lastMessageAt).toLocaleDateString()}.`
      : 'No conversations yet.',
    generatedAt: Date.now(),
  }
  getDb()
    .prepare(`UPDATE students SET pinnedSummaryJson = ?, summaryUpdatedAt = ? WHERE id = ?`)
    .run(JSON.stringify(summary), summary.generatedAt, studentId)
  return summary
}
