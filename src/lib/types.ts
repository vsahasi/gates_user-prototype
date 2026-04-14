// src/lib/types.ts

export type IntentCategory =
  | 'profile_collection'
  | 'career_exploration'
  | 'program_comparison'
  | 'pathway_recommendation'
  | 'application_prep'
  | 'general_question'

export type SchoolType =
  | 'community_college'
  | '4_year_public'
  | '4_year_private'
  | 'tribal'
  | 'arts'

export interface School {
  unitId: string
  opeid: string
  name: string
  state: string
  type: SchoolType
  city: string
  inStateTuition: number
  outOfStateTuition: number
  netPriceMedian: number
  gradRate: number
  admissionRate: number | null
  satRange: [number, number] | null
  programs: string[] // CIP codes
  medianEarnings10yr: number
  medianLoanDebt: number
  applicationDeadline: string
  earlyDecisionDeadline: string | null
  requiresTestScore: boolean
  avgAidPackage: number
  pctReceivingAid: number
  specialNotes: string[]
  dataYear: number
}

export interface Persona {
  id: string
  name: string
  grade: number
  state: string
  situation: string
  background: string
  goal: string
  keyBarriers: string[]
  specialCircumstances: string[]
  samplePrompts: string[]
  initialProfile: Partial<StudentProfile>
}

export interface StudentProfile {
  grade: number | null
  state: string | null
  interests: string[]
  gpa: number | null
  financialInfo: {
    incomeRange: string | null
    pellEligible: boolean | null
    hasParentalSupport: boolean | null
  }
  constraints: string[]
  specialCircumstances: string[]
  goals: string[]
  programInterests: string[]
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  structuredComponent?: StructuredComponent
}

export interface StructuredComponent {
  type: 'comparison_table' | 'pathway_cards' | 'timeline_checklist'
  data: ComparisonTableData | PathwayCardsData | TimelineChecklistData
}

export interface ComparisonTableData {
  schools: School[]
  fields: Array<keyof School>
  labels: Record<string, string>
}

export interface PathwayCardsData {
  pathways: PathwayCard[]
}

export interface PathwayCard {
  title: string
  type: string
  description: string
  timeToComplete: string
  estimatedCost: string
  earnings: string
  nextStep: string
  fit: 'high' | 'medium' | 'low'
}

export interface TimelineChecklistData {
  title: string
  items: ChecklistItem[]
}

export interface ChecklistItem {
  week: string
  task: string
  detail: string
  deadline: string | null
  resource: string | null
}

export interface SessionState {
  sessionId: string
  personaId: string | null
  studentProfile: StudentProfile
  conversationHistory: Message[]
  priorRecommendations: string[]
  createdAt: number
  lastActiveAt: number
}

export interface RAGQueryParams {
  state?: string
  type?: SchoolType[]
  cipCodes?: string[]
  maxTuition?: number
  query?: string
}

export interface RAGResult {
  school: School
  score: number
}

export interface IntentClassification {
  intent: IntentCategory
  extractedParams: {
    state?: string
    cipCodes?: string[]
    schoolNames?: string[]
    degreeLevel?: string
    maxBudget?: number
  }
  rewrittenQuery: string
}
