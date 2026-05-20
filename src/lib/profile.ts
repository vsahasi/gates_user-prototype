// src/lib/profile.ts
import type { StudentProfile } from '@/lib/types'
import { DEFAULT_PROFILE } from '@/lib/defaults'

export function mergeProfile(initial: Partial<StudentProfile>): StudentProfile {
  return {
    ...DEFAULT_PROFILE,
    ...initial,
    financialInfo: { ...DEFAULT_PROFILE.financialInfo, ...(initial.financialInfo ?? {}) },
  }
}
