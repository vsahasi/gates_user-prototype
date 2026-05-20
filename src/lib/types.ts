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
  // Numeric fields are nullable where the upstream source (Scorecard/IPEDS)
  // may omit them. Prompt + UI layers MUST render nulls as "unknown", never $0.
  inStateTuition: number | null
  outOfStateTuition: number | null
  netPriceMedian: number | null
  gradRate: number | null
  admissionRate: number | null
  satRange: [number, number] | null
  programs: string[] // CIP codes
  medianEarnings10yr: number | null
  medianLoanDebt: number | null
  applicationDeadline: string
  earlyDecisionDeadline: string | null
  requiresTestScore: boolean
  avgAidPackage: number | null
  pctReceivingAid: number | null
  specialNotes: string[]
  dataYear: number | null
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
  type:
    | 'comparison_table'
    | 'pathway_cards'
    | 'timeline_checklist'
    | 'decision_matrix'
    | 'financial_aid_view'
    | 'fafsa_draft'
    | 'essay_draft'
    | 'suggested_replies'
  data:
    | ComparisonTableData
    | PathwayCardsData
    | TimelineChecklistData
    | DecisionMatrixData
    | FinancialAidViewData
    | FAFSADraftData
    | EssayDraftData
    | SuggestedRepliesData
}

export interface SuggestedRepliesData {
  options: string[]
}

export interface DecisionMatrixData {
  options: Array<{
    id: string
    label: string
    scores: Record<string, number>
  }>
  criteria: Array<{ id: string; label: string; weight: number }>
}

export interface FinancialAidViewData {
  schools: string[]
  familyIncome: number
  expectedFamilyContribution?: number
}

export interface FAFSADraftData {
  sections: Array<{
    id: string
    title: string
    fields: Array<{ id: string; label: string; value: string; help?: string }>
  }>
}

export interface EssayDraftData {
  prompt: string
  draft: string
  variants?: string[]
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
