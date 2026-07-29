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

export async function getOrCreateSession(
  sessionId: string,
  personaId?: string,
  studentId?: string,
): Promise<SessionState> {
  let conv = await getConversation(sessionId)
  if (!conv) {
    if (!studentId) {
      throw new Error('Cannot create session without studentId')
    }
    conv = await createConversation(studentId, 'New conversation')
  }
  const profile = (await getStudentProfile(conv.studentId)) ?? { ...DEFAULT_PROFILE }
  const messages = await listMessages(conv.id)
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

export async function setStudentProfile(
  sessionId: string,
  profile: Partial<StudentProfile>,
): Promise<void> {
  const conv = await getConversation(sessionId)
  if (!conv) return
  const current = (await getStudentProfile(conv.studentId)) ?? { ...DEFAULT_PROFILE }
  const next: StudentProfile = {
    ...current,
    ...profile,
    financialInfo: { ...current.financialInfo, ...(profile.financialInfo ?? {}) },
  }
  await upsertStudentProfile(conv.studentId, next)
}

export async function updateStudentProfile(
  sessionId: string,
  updates: Partial<StudentProfile>,
): Promise<void> {
  const conv = await getConversation(sessionId)
  if (!conv) return
  const current = (await getStudentProfile(conv.studentId)) ?? { ...DEFAULT_PROFILE }
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
  await upsertStudentProfile(conv.studentId, merged)
}

export async function getSession(sessionId: string): Promise<SessionState | undefined> {
  const conv = await getConversation(sessionId)
  if (!conv) return undefined
  return getOrCreateSession(sessionId)
}

// Process-lifetime pruning is no longer relevant — DB persists.
export function pruneOldSessions(): void {}
