// src/lib/adaptive/signals.ts
import type { StudentProfile } from '@/lib/types'
import type { Tone } from './tone'

export type Readiness = 'exploring' | 'weighing' | 'deciding' | 'acting'
export type CognitiveLoad = 'low' | 'medium' | 'high'
export type DeadlinePressure = 'none' | 'upcoming' | 'imminent'

export interface Signals {
  tone: Tone
  readiness: Readiness
  cognitiveLoad: CognitiveLoad
  deadlinePressure: DeadlinePressure
}

export interface Deadline {
  id: string
  label: string
  dueAt: number
}

export function computeReadiness(input: {
  messageCount: number
  profile: StudentProfile
  intent: string
  shortlist?: string[]
  deadlines?: Deadline[]
}): Readiness {
  const hasShortlist = (input.shortlist?.length ?? 0) >= 2
  const hasFocus = (input.profile.interests?.length ?? 0) > 0
  const hasDeadlines = (input.deadlines?.length ?? 0) > 0

  if (hasDeadlines && /application|prep|essay|fafsa/i.test(input.intent)) return 'acting'
  if (hasShortlist && /compare|choose|decide|trade/i.test(input.intent)) return 'deciding'
  if (hasFocus || input.messageCount > 3) return 'weighing'
  return 'exploring'
}

const TOPIC_KEYWORDS: Record<string, RegExp> = {
  major: /major|study|field|degree/i,
  test: /sat|act|test|score/i,
  cost: /cost|tuition|aid|loan|fafsa|net price/i,
  school: /college|school|university|campus/i,
  career: /career|job|salary|work/i,
  application: /apply|application|essay|deadline/i,
}

export function computeCognitiveLoad(history: Array<{ content: string }>): CognitiveLoad {
  const recent = history.slice(-5)
  const topics = new Set<string>()
  for (const m of recent) {
    for (const [k, re] of Object.entries(TOPIC_KEYWORDS)) {
      if (re.test(m.content)) topics.add(k)
    }
  }
  if (topics.size >= 4) return 'high'
  if (topics.size >= 2) return 'medium'
  return 'low'
}

export function computeDeadlinePressure(
  deadlines: Deadline[],
  now: number = Date.now(),
): DeadlinePressure {
  let pressure: DeadlinePressure = 'none'
  for (const d of deadlines) {
    const days = (d.dueAt - now) / (24 * 60 * 60 * 1000)
    if (days < 0) continue
    if (days < 3) return 'imminent'
    if (days < 14) pressure = 'upcoming'
  }
  return pressure
}
