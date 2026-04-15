// src/lib/defaults.ts
import type { StudentProfile } from '@/lib/types'

export const DEFAULT_PROFILE: StudentProfile = {
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
