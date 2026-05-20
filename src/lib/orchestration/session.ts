// src/lib/orchestration/session.ts
import type { Message, SessionState, StudentProfile } from '@/lib/types'
import { DEFAULT_PROFILE } from '@/lib/defaults'
import {
  getConversation,
  getStudentProfile,
  upsertStudentProfile,
  listMessages,
  createConversation,
} from '@/lib/db/queries'

export function getOrCreateSession(
  sessionId: string,
  personaId?: string,
  studentId?: string,
): SessionState {
  let conv = getConversation(sessionId)
  if (!conv) {
    if (!studentId) {
      throw new Error('Cannot create session without studentId')
    }
    conv = createConversation(studentId, 'New conversation')
  }
  const profile = getStudentProfile(conv.studentId) ?? { ...DEFAULT_PROFILE }
  const messages = listMessages(conv.id)
  const conversationHistory: Message[] = messages.map((m) => ({
    role: m.role === 'system' ? 'assistant' : (m.role as 'user' | 'assistant'),
    content: m.content,
    timestamp: m.timestamp,
  }))
  return {
    sessionId: conv.id,
    personaId: personaId ?? null,
    studentProfile: profile,
    conversationHistory,
    priorRecommendations: [],
    createdAt: conv.createdAt,
    lastActiveAt: conv.lastMessageAt,
  }
}

export function setStudentProfile(sessionId: string, profile: Partial<StudentProfile>): void {
  const conv = getConversation(sessionId)
  if (!conv) return
  const current = getStudentProfile(conv.studentId) ?? { ...DEFAULT_PROFILE }
  const next: StudentProfile = {
    ...current,
    ...profile,
    financialInfo: { ...current.financialInfo, ...(profile.financialInfo ?? {}) },
  }
  upsertStudentProfile(conv.studentId, next)
}

export function updateStudentProfile(
  sessionId: string,
  updates: Partial<StudentProfile>,
): void {
  const conv = getConversation(sessionId)
  if (!conv) return
  const current = getStudentProfile(conv.studentId) ?? { ...DEFAULT_PROFILE }
  const merged: StudentProfile = {
    ...current,
    ...updates,
    interests: Array.from(new Set([...(current.interests ?? []), ...(updates.interests ?? [])])),
    constraints: Array.from(new Set([...(current.constraints ?? []), ...(updates.constraints ?? [])])),
    specialCircumstances: Array.from(new Set([
      ...(current.specialCircumstances ?? []),
      ...(updates.specialCircumstances ?? []),
    ])),
    goals: Array.from(new Set([...(current.goals ?? []), ...(updates.goals ?? [])])),
    financialInfo: { ...current.financialInfo, ...(updates.financialInfo ?? {}) },
  }
  upsertStudentProfile(conv.studentId, merged)
}

export function getSession(sessionId: string): SessionState | undefined {
  const conv = getConversation(sessionId)
  if (!conv) return undefined
  return getOrCreateSession(sessionId)
}

// Process-lifetime pruning is no longer relevant — DB persists.
export function pruneOldSessions(): void {}
