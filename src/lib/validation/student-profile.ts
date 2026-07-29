// src/lib/validation/student-profile.ts
import { z } from 'zod'

// Mirrors StudentProfile in src/lib/types.ts. All fields optional because
// clients send partial profiles (only the fields collected so far).
export const StudentProfileSchema = z.object({
  grade: z.number().int().min(1).max(16).nullable(),
  state: z.string().length(2).nullable(),
  interests: z.array(z.string().max(200)).max(50),
  gpa: z.number().min(0).max(5).nullable(),
  financialInfo: z.object({
    incomeRange: z.string().max(100).nullable(),
    pellEligible: z.boolean().nullable(),
    hasParentalSupport: z.boolean().nullable(),
  }),
  constraints: z.array(z.string().max(200)).max(50),
  specialCircumstances: z.array(z.string().max(200)).max(50),
  goals: z.array(z.string().max(200)).max(50),
  programInterests: z.array(z.string().max(200)).max(50),
}).partial()
