// src/lib/orchestration/session.ts
import type { SessionState, StudentProfile } from '@/lib/types'

const DEFAULT_PROFILE: StudentProfile = {
  grade: null,
  state: null,
  interests: [],
  gpa: null,
  financialInfo: { incomeRange: null, pellEligible: null, hasParentalSupport: null },
  constraints: [],
  specialCircumstances: [],
  goals: [],
  programInterests: [],
}

// Module-level store — persists across requests in a single Node.js process
const sessions = new Map<string, SessionState>()

export function getOrCreateSession(sessionId: string, personaId?: string): SessionState {
  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!
    session.lastActiveAt = Date.now()
    return session
  }

  const session: SessionState = {
    sessionId,
    personaId: personaId ?? null,
    studentProfile: { ...DEFAULT_PROFILE },
    conversationHistory: [],
    priorRecommendations: [],
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  }

  sessions.set(sessionId, session)
  return session
}

export function updateSession(sessionId: string, updates: Partial<SessionState>): void {
  const session = sessions.get(sessionId)
  if (!session) return
  Object.assign(session, updates, { lastActiveAt: Date.now() })
}

export function updateStudentProfile(
  sessionId: string,
  profileUpdates: Partial<StudentProfile>
): void {
  const session = sessions.get(sessionId)
  if (!session) return
  session.studentProfile = {
    ...session.studentProfile,
    ...profileUpdates,
    interests: [
      ...new Set([...(session.studentProfile.interests ?? []), ...(profileUpdates.interests ?? [])]),
    ],
    constraints: [
      ...new Set([...(session.studentProfile.constraints ?? []), ...(profileUpdates.constraints ?? [])]),
    ],
    specialCircumstances: [
      ...new Set([
        ...(session.studentProfile.specialCircumstances ?? []),
        ...(profileUpdates.specialCircumstances ?? []),
      ]),
    ],
    goals: [
      ...new Set([...(session.studentProfile.goals ?? []), ...(profileUpdates.goals ?? [])]),
    ],
  }
  session.lastActiveAt = Date.now()
}

export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId)
}

// Prune sessions older than 2 hours
export function pruneOldSessions(): void {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000
  for (const [id, session] of sessions) {
    if (session.lastActiveAt < cutoff) sessions.delete(id)
  }
}
