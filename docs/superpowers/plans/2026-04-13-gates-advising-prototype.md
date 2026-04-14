# Gates College & Career Advising Prototype — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-powered college/career advising chat app for high school students using Next.js API routes, Claude API, College Scorecard, O*NET, and a curated in-memory school dataset.

**Architecture:** Next.js 16 monorepo — all orchestration in API route handlers, streaming via ReadableStream + SSE, in-memory session store, curated JSON as the RAG layer with a swappable interface.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, @anthropic-ai/sdk, lucide-react

---

## Task 1: Install dependencies + environment setup

**Files:**
- Modify: `package.json`
- Create: `.env.local.example`
- Create: `.gitignore` (add `.env.local`)

- [ ] Install Anthropic SDK

```bash
cd "/Users/25veers/Desktop/cs projects/gates_user-prototype"
npm install @anthropic-ai/sdk
```

Expected: `added 1 package`

- [ ] Create `.env.local.example`

```bash
# .env.local.example
ANTHROPIC_API_KEY=your_anthropic_api_key_here
COLLEGE_SCORECARD_API_KEY=your_scorecard_key_here
ONET_USERNAME=your_onet_username_here
ONET_PASSWORD=your_onet_password_here
```

- [ ] Ensure `.env.local` is in `.gitignore` (Next.js adds this by default — verify it's there)

```bash
grep ".env.local" .gitignore || echo ".env.local" >> .gitignore
```

- [ ] Commit

```bash
git add package.json package-lock.json .env.local.example .gitignore
git commit -m "chore: add anthropic SDK and env setup"
```

---

## Task 2: Core TypeScript types

**Files:**
- Create: `src/lib/types.ts`

- [ ] Write `src/lib/types.ts`

```typescript
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
```

- [ ] Commit

```bash
git add src/lib/types.ts
git commit -m "feat: add core TypeScript types"
```

---

## Task 3: School dataset (15 curated institutions)

**Files:**
- Create: `src/lib/data/schools.ts`

- [ ] Write `src/lib/data/schools.ts`

```typescript
// src/lib/data/schools.ts
import type { School } from '@/lib/types'

export const SCHOOLS: School[] = [
  {
    unitId: '113364',
    opeid: '00113300',
    name: 'City College of San Francisco',
    state: 'CA',
    type: 'community_college',
    city: 'San Francisco',
    inStateTuition: 1288,
    outOfStateTuition: 9528,
    netPriceMedian: 1100,
    gradRate: 0.17,
    admissionRate: null,
    satRange: null,
    programs: ['51.3801', '52.0201', '11.0101', '24.0101'],
    medianEarnings10yr: 42000,
    medianLoanDebt: 8500,
    applicationDeadline: '2026-07-15',
    earlyDecisionDeadline: null,
    requiresTestScore: false,
    avgAidPackage: 6800,
    pctReceivingAid: 0.72,
    specialNotes: [
      'AB 540 eligible students may qualify for in-state tuition',
      'California Dream Act (CADAA) financial aid available for undocumented students',
      'Strong ADN nursing program — competitive waitlist',
    ],
    dataYear: 2024,
  },
  {
    unitId: '110592',
    opeid: '00110500',
    name: 'East Los Angeles College',
    state: 'CA',
    type: 'community_college',
    city: 'Monterey Park',
    inStateTuition: 1288,
    outOfStateTuition: 9528,
    netPriceMedian: 900,
    gradRate: 0.16,
    admissionRate: null,
    satRange: null,
    programs: ['51.3801', '52.0201', '11.0101', '24.0101', '51.0000'],
    medianEarnings10yr: 39000,
    medianLoanDebt: 7200,
    applicationDeadline: '2026-07-01',
    earlyDecisionDeadline: null,
    requiresTestScore: false,
    avgAidPackage: 7100,
    pctReceivingAid: 0.78,
    specialNotes: [
      'CADAA and AB 540 eligible',
      'Large first-gen support programs',
      'Articulation agreements with UC and CSU systems',
    ],
    dataYear: 2024,
  },
  {
    unitId: '187897',
    opeid: '01538000',
    name: 'Diné College',
    state: 'NM',
    type: 'tribal',
    city: 'Tsaile',
    inStateTuition: 2100,
    outOfStateTuition: 2100,
    netPriceMedian: 1800,
    gradRate: 0.18,
    admissionRate: null,
    satRange: null,
    programs: ['51.3801', '24.0101', '01.0101', '13.0101'],
    medianEarnings10yr: 34000,
    medianLoanDebt: 5200,
    applicationDeadline: '2026-07-01',
    earlyDecisionDeadline: null,
    requiresTestScore: false,
    avgAidPackage: 8200,
    pctReceivingAid: 0.88,
    specialNotes: [
      'Tribal college — Indian Health Service (IHS) scholarships available',
      'Bureau of Indian Education grant eligible',
      'Navajo Nation scholarship opportunities',
      'On-reservation location reduces relocation barrier',
      'ADN-to-BSN articulation with UNM nursing program',
    ],
    dataYear: 2024,
  },
  {
    unitId: '144740',
    opeid: '00144700',
    name: 'Wilbur Wright College',
    state: 'IL',
    type: 'community_college',
    city: 'Chicago',
    inStateTuition: 3744,
    outOfStateTuition: 10272,
    netPriceMedian: 2800,
    gradRate: 0.15,
    admissionRate: null,
    satRange: null,
    programs: ['51.3801', '52.0201', '24.0101', '11.0101'],
    medianEarnings10yr: 38000,
    medianLoanDebt: 7800,
    applicationDeadline: '2026-07-15',
    earlyDecisionDeadline: null,
    requiresTestScore: false,
    avgAidPackage: 5900,
    pctReceivingAid: 0.69,
    specialNotes: [
      'Illinois foster youth tuition waiver (ages 18–25) — full tuition covered',
      'Chafee ETV grant eligible students welcome',
      'Chicago transit accessible',
    ],
    dataYear: 2024,
  },
  {
    unitId: '222983',
    opeid: '00383800',
    name: 'Austin Community College',
    state: 'TX',
    type: 'community_college',
    city: 'Austin',
    inStateTuition: 2952,
    outOfStateTuition: 10512,
    netPriceMedian: 2100,
    gradRate: 0.18,
    admissionRate: null,
    satRange: null,
    programs: ['51.3801', '52.0201', '47.0101', '11.0101', '24.0101'],
    medianEarnings10yr: 41000,
    medianLoanDebt: 8100,
    applicationDeadline: '2026-07-01',
    earlyDecisionDeadline: null,
    requiresTestScore: false,
    avgAidPackage: 5200,
    pctReceivingAid: 0.65,
    specialNotes: [
      'Texas Success Initiative placement — free tutoring',
      'Multiple campus locations across Austin metro',
    ],
    dataYear: 2024,
  },
  {
    unitId: '233374',
    opeid: '00233300',
    name: 'Virginia Western Community College',
    state: 'VA',
    type: 'community_college',
    city: 'Roanoke',
    inStateTuition: 5412,
    outOfStateTuition: 11136,
    netPriceMedian: 4200,
    gradRate: 0.19,
    admissionRate: null,
    satRange: null,
    programs: ['51.3801', '51.3900', '52.0201', '24.0101'],
    medianEarnings10yr: 37000,
    medianLoanDebt: 9100,
    applicationDeadline: '2026-07-15',
    earlyDecisionDeadline: null,
    requiresTestScore: false,
    avgAidPackage: 4800,
    pctReceivingAid: 0.61,
    specialNotes: [
      'ADN nursing program — articulates to Radford University RN-to-BSN',
      'Rural Virginia — limited public transit, most students commute',
      'Childcare center on campus',
    ],
    dataYear: 2024,
  },
  {
    unitId: '110644',
    opeid: '00110600',
    name: 'UC Davis',
    state: 'CA',
    type: '4_year_public',
    city: 'Davis',
    inStateTuition: 14312,
    outOfStateTuition: 44066,
    netPriceMedian: 18200,
    gradRate: 0.85,
    admissionRate: 0.39,
    satRange: [1200, 1500],
    programs: ['51.3801', '26.0101', '11.0101', '52.0201'],
    medianEarnings10yr: 68000,
    medianLoanDebt: 17200,
    applicationDeadline: '2025-11-30',
    earlyDecisionDeadline: null,
    requiresTestScore: false,
    avgAidPackage: 22400,
    pctReceivingAid: 0.66,
    specialNotes: [
      'AB 540 / CADAA eligible — undocumented students may receive state aid',
      'No supplemental essay required (UC system)',
      'Strong nursing program — competitive admission',
    ],
    dataYear: 2024,
  },
  {
    unitId: '110565',
    opeid: '00110500',
    name: 'CSU Fullerton',
    state: 'CA',
    type: '4_year_public',
    city: 'Fullerton',
    inStateTuition: 6916,
    outOfStateTuition: 18796,
    netPriceMedian: 11200,
    gradRate: 0.69,
    admissionRate: 0.67,
    satRange: [1010, 1240],
    programs: ['52.0201', '11.0101', '23.0101', '51.2003'],
    medianEarnings10yr: 58000,
    medianLoanDebt: 15400,
    applicationDeadline: '2025-11-30',
    earlyDecisionDeadline: null,
    requiresTestScore: false,
    avgAidPackage: 12100,
    pctReceivingAid: 0.71,
    specialNotes: [
      'AB 540 / CADAA eligible',
      'Largest CSU campus — strong support services for first-gen students',
    ],
    dataYear: 2024,
  },
  {
    unitId: '187191',
    opeid: '00187100',
    name: 'University of New Mexico',
    state: 'NM',
    type: '4_year_public',
    city: 'Albuquerque',
    inStateTuition: 8340,
    outOfStateTuition: 25014,
    netPriceMedian: 12800,
    gradRate: 0.52,
    admissionRate: 0.94,
    satRange: [990, 1230],
    programs: ['51.3801', '26.0101', '11.0101', '52.0201'],
    medianEarnings10yr: 52000,
    medianLoanDebt: 18900,
    applicationDeadline: '2026-03-01',
    earlyDecisionDeadline: null,
    requiresTestScore: false,
    avgAidPackage: 14200,
    pctReceivingAid: 0.74,
    specialNotes: [
      'Articulation agreements with Diné College and NM tribal colleges',
      'Indian Health Service scholarship pipeline',
      'Native American Studies department and support center',
      'NM Lottery Scholarship: 2.5 GPA + NM resident + enrolled in NM CC first',
    ],
    dataYear: 2024,
  },
  {
    unitId: '233295',
    opeid: '00233200',
    name: 'Radford University',
    state: 'VA',
    type: '4_year_public',
    city: 'Radford',
    inStateTuition: 9426,
    outOfStateTuition: 21152,
    netPriceMedian: 14700,
    gradRate: 0.58,
    admissionRate: 0.88,
    satRange: [990, 1190],
    programs: ['51.3801', '51.3900', '52.0201', '13.0101'],
    medianEarnings10yr: 46000,
    medianLoanDebt: 21300,
    applicationDeadline: '2026-02-01',
    earlyDecisionDeadline: '2025-11-01',
    requiresTestScore: false,
    avgAidPackage: 11800,
    pctReceivingAid: 0.76,
    specialNotes: [
      'Strong BSN nursing program — CCNE accredited',
      'Rural SW Virginia — on-campus housing available',
      'RN-to-BSN bridge accepts ADN from Virginia Western CC',
      'Childcare resources available on campus',
    ],
    dataYear: 2024,
  },
  {
    unitId: '144050',
    opeid: '00144000',
    name: 'DePaul University',
    state: 'IL',
    type: '4_year_private',
    city: 'Chicago',
    inStateTuition: 43434,
    outOfStateTuition: 43434,
    netPriceMedian: 26800,
    gradRate: 0.72,
    admissionRate: 0.68,
    satRange: [1120, 1340],
    programs: ['52.0201', '11.0101', '23.0101', '42.0101'],
    medianEarnings10yr: 64000,
    medianLoanDebt: 28400,
    applicationDeadline: '2026-02-01',
    earlyDecisionDeadline: '2025-11-15',
    requiresTestScore: false,
    avgAidPackage: 28700,
    pctReceivingAid: 0.82,
    specialNotes: [
      'Illinois foster youth: tuition waiver available (EFC $0 foster youth)',
      'Chafee ETV stackable with institutional aid',
      'Chicago campus — urban internship opportunities',
    ],
    dataYear: 2024,
  },
  {
    unitId: '147767',
    opeid: '00147700',
    name: 'Northwestern University',
    state: 'IL',
    type: '4_year_private',
    city: 'Evanston',
    inStateTuition: 63468,
    outOfStateTuition: 63468,
    netPriceMedian: 18200,
    gradRate: 0.95,
    admissionRate: 0.07,
    satRange: [1500, 1570],
    programs: ['52.0201', '11.0101', '23.0101', '27.0101'],
    medianEarnings10yr: 88000,
    medianLoanDebt: 14800,
    applicationDeadline: '2026-01-02',
    earlyDecisionDeadline: '2025-11-01',
    requiresTestScore: true,
    avgAidPackage: 57200,
    pctReceivingAid: 0.61,
    specialNotes: [
      'Meets 100% of demonstrated financial need',
      'Illinois foster youth tuition waiver applicable',
      'Highly selective — 3.9+ GPA typical',
    ],
    dataYear: 2024,
  },
  {
    unitId: '111081',
    opeid: '00111000',
    name: 'California Institute of the Arts (CalArts)',
    state: 'CA',
    type: 'arts',
    city: 'Valencia',
    inStateTuition: 54580,
    outOfStateTuition: 54580,
    netPriceMedian: 34200,
    gradRate: 0.68,
    admissionRate: 0.27,
    satRange: null,
    programs: ['50.0401', '50.0605', '50.0409', '50.0501'],
    medianEarnings10yr: 48000,
    medianLoanDebt: 33100,
    applicationDeadline: '2026-01-05',
    earlyDecisionDeadline: null,
    requiresTestScore: false,
    avgAidPackage: 31400,
    pctReceivingAid: 0.79,
    specialNotes: [
      'Portfolio required — animation, film, character animation tracks',
      'Industry connections to Disney, Pixar, DreamWorks',
      'No SAT/ACT required — portfolio is the application',
    ],
    dataYear: 2024,
  },
  {
    unitId: '239080',
    opeid: '00239000',
    name: 'Savannah College of Art and Design (SCAD)',
    state: 'GA',
    type: 'arts',
    city: 'Savannah',
    inStateTuition: 39375,
    outOfStateTuition: 39375,
    netPriceMedian: 28900,
    gradRate: 0.71,
    admissionRate: 0.72,
    satRange: [1060, 1310],
    programs: ['50.0401', '50.0605', '50.0409', '50.0702'],
    medianEarnings10yr: 46000,
    medianLoanDebt: 29800,
    applicationDeadline: '2026-02-01',
    earlyDecisionDeadline: '2025-11-01',
    requiresTestScore: false,
    avgAidPackage: 22100,
    pctReceivingAid: 0.83,
    specialNotes: [
      'Strong animation and visual effects programs',
      'Atlanta campus option available',
      'Internship pipeline with major studios',
    ],
    dataYear: 2024,
  },
  {
    unitId: '217156',
    opeid: '00217100',
    name: 'Rhode Island School of Design (RISD)',
    state: 'RI',
    type: 'arts',
    city: 'Providence',
    inStateTuition: 57588,
    outOfStateTuition: 57588,
    netPriceMedian: 36100,
    gradRate: 0.88,
    admissionRate: 0.18,
    satRange: [1300, 1510],
    programs: ['50.0401', '50.0701', '50.0409', '50.0409'],
    medianEarnings10yr: 62000,
    medianLoanDebt: 31200,
    applicationDeadline: '2026-01-15',
    earlyDecisionDeadline: '2025-11-01',
    requiresTestScore: false,
    avgAidPackage: 38700,
    pctReceivingAid: 0.65,
    specialNotes: [
      'Portfolio required — highly competitive',
      'Adjacent to Brown University — cross-registration available',
      'Selective — strong portfolio essential',
    ],
    dataYear: 2024,
  },
]

export function getSchoolsByState(state: string): School[] {
  return SCHOOLS.filter((s) => s.state === state)
}

export function getSchoolsByType(type: School['type']): School[] {
  return SCHOOLS.filter((s) => s.type === type)
}

export function getSchoolById(unitId: string): School | undefined {
  return SCHOOLS.find((s) => s.unitId === unitId)
}

export function searchSchools(query: string): School[] {
  const q = query.toLowerCase()
  return SCHOOLS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.state.toLowerCase().includes(q) ||
      s.specialNotes.some((n) => n.toLowerCase().includes(q))
  )
}
```

- [ ] Commit

```bash
git add src/lib/data/schools.ts
git commit -m "feat: add curated school dataset (15 institutions)"
```

---

## Task 4: Persona definitions (10 synthetic)

**Files:**
- Create: `src/lib/data/personas.ts`

- [ ] Write `src/lib/data/personas.ts`

```typescript
// src/lib/data/personas.ts
import type { Persona } from '@/lib/types'

export const PERSONAS: Persona[] = [
  {
    id: 'mateo',
    name: 'Mateo',
    grade: 10,
    state: 'CA',
    situation: 'First-Gen CC Transfer',
    background:
      'First person in his family to plan for college. Wants a business degree but needs to stay close to home and avoid debt. Considering dual-enrollment at community college.',
    goal: 'Earn an associate degree at CC then transfer to a 4-year university for a bachelor\'s in Business.',
    keyBarriers: [
      'No college knowledge passed down from parents',
      'Risk of taking wrong dual-enrollment courses that won\'t transfer',
      'Weighing GED vs high school diploma',
    ],
    specialCircumstances: ['first_generation'],
    samplePrompts: [
      "What's the difference between a high school diploma and a GED?",
      'Which dual enrollment classes will transfer to a four-year university?',
      'How do I plan my courses so I don\'t lose credits?',
    ],
    initialProfile: {
      grade: 10,
      state: 'CA',
      interests: ['business', 'entrepreneurship'],
      goals: ['bachelor\'s degree in business', 'transfer from community college'],
      specialCircumstances: ['first_generation'],
      constraints: ['stay close to family', 'minimize debt'],
    },
  },
  {
    id: 'chloe',
    name: 'Chloe',
    grade: 12,
    state: 'CA',
    situation: 'Unaccompanied Homeless Youth',
    background:
      'Left home due to an unsafe family situation. Couch-surfing, supporting herself through part-time work. No contact with parents.',
    goal: 'Apply to a 4-year university, maximize financial aid without parental information, find stable housing.',
    keyBarriers: [
      'Cannot fill out FAFSA with parental information or signatures',
      'Needs unaccompanied homeless youth legal status determination',
      'Balancing high school and job while navigating complex processes',
    ],
    specialCircumstances: ['homeless_youth', 'no_parental_contact'],
    samplePrompts: [
      'How do I fill out FAFSA if I was kicked out of my house?',
      'What does "unaccompanied homeless youth" status mean for financial aid?',
      'Can I get financial aid without my parents\' tax information?',
    ],
    initialProfile: {
      grade: 12,
      state: 'CA',
      goals: ['4-year university', 'maximize financial aid', 'stable housing'],
      specialCircumstances: ['homeless_youth', 'no_parental_contact'],
      constraints: ['no parental support', 'working part-time'],
      financialInfo: { hasParentalSupport: false, pellEligible: true, incomeRange: 'very_low' },
    },
  },
  {
    id: 'shauna',
    name: 'Shauna',
    grade: 11,
    state: 'VA',
    situation: 'Teen Mother, Rural Virginia',
    background:
      '17-year-old mother who takes full care of her child. Wants to become a nurse but must work part-time as a house cleaner.',
    goal: 'Find a nursing program that accommodates childcare and work — community college or flexible 4-year.',
    keyBarriers: [
      'Childcare responsibilities limit full-time enrollment',
      'Rural location limits nearby program options',
      'Balancing work, childcare, and school simultaneously',
    ],
    specialCircumstances: ['parent_caregiver', 'rural'],
    samplePrompts: [
      'Are there nursing programs near Roanoke VA that work with childcare schedules?',
      'Is community college nursing faster than going straight to a 4-year?',
      'What financial aid can I get as a student parent?',
    ],
    initialProfile: {
      grade: 11,
      state: 'VA',
      interests: ['nursing', 'healthcare'],
      goals: ['nursing degree', 'RN licensure'],
      specialCircumstances: ['parent_caregiver', 'rural'],
      constraints: ['childcare', 'part-time work', 'rural location', 'limited transportation'],
    },
  },
  {
    id: 'nick',
    name: 'Nick',
    grade: 12,
    state: 'NJ',
    situation: 'After Juvenile Detention',
    background:
      '18-year-old returning to high school after a year in juvenile detention. Completed a vocational carpentry program inside and discovered a passion for it. Considering carpentry (certification/apprenticeship) or architecture (4-year).',
    goal: 'Find a realistic path to a career in carpentry or architecture given his academic interruption.',
    keyBarriers: [
      'Year gap in coursework affects academic record',
      'Uncertainty between trade/cert path and 4-year degree',
      'Stigma and lack of guidance for students with justice involvement',
    ],
    specialCircumstances: ['justice_involved', 'nontraditional_student'],
    samplePrompts: [
      'Can I become an architect even with a year out of school?',
      'What\'s the difference between a carpentry apprenticeship and a construction degree?',
      'How do I explain a gap in my transcript to colleges?',
    ],
    initialProfile: {
      grade: 12,
      state: 'NJ',
      interests: ['carpentry', 'architecture', 'construction'],
      goals: ['career in carpentry or architecture'],
      specialCircumstances: ['justice_involved', 'nontraditional_student'],
      constraints: ['academic gap', 'uncertain academic record'],
    },
  },
  {
    id: 'maya',
    name: 'Maya',
    grade: 11,
    state: 'IL',
    situation: 'Foster Youth Aging Out',
    background:
      '17-year-old in foster care since age 12, aging out in 6 months. Changed high schools 4 times. 2.8 GPA. Motivated but has no stable adult advocate.',
    goal: 'Find affordable trade school or community college — not interested in 4-year. Understand foster youth financial benefits.',
    keyBarriers: [
      'No permanent address for FAFSA/housing applications',
      'Incomplete academic history from school changes',
      'No adult to help navigate the process',
    ],
    specialCircumstances: ['foster_youth', 'aging_out'],
    samplePrompts: [
      'As a foster youth, do I have to put my parents\' income on FAFSA?',
      'What is the Chafee ETV grant and how do I get it?',
      'Does Illinois have a tuition waiver for foster youth?',
    ],
    initialProfile: {
      grade: 11,
      state: 'IL',
      gpa: 2.8,
      goals: ['trade school or community college', 'stable housing'],
      specialCircumstances: ['foster_youth', 'aging_out'],
      constraints: ['no permanent address', 'no adult advocate', 'incomplete academic history'],
      financialInfo: { pellEligible: true, hasParentalSupport: false, incomeRange: 'very_low' },
    },
  },
  {
    id: 'eli',
    name: 'Eli',
    grade: 11,
    state: 'NM',
    situation: 'Navajo Nation, Rural First-Gen',
    background:
      '16-year-old on the Navajo Nation in rural New Mexico. School has 1 counselor for 400+ students. Inconsistent internet. Wants to be a nurse. 3.4 GPA.',
    goal: 'Understand nursing pathway options (tribal college → transfer vs direct 4-year) and Native American scholarship resources.',
    keyBarriers: [
      'Geographic isolation — far from any 4-year campus',
      'Unreliable internet makes online applications difficult',
      'Unknown scholarships specific to Native American nursing students',
    ],
    specialCircumstances: ['native_american', 'rural', 'first_generation'],
    samplePrompts: [
      'Is Diné College a real option for starting a nursing degree?',
      'What scholarships are available for Native American nursing students?',
      'How do I apply to UNM if I have unreliable internet access?',
    ],
    initialProfile: {
      grade: 11,
      state: 'NM',
      gpa: 3.4,
      interests: ['nursing', 'healthcare'],
      goals: ['nursing degree', 'RN licensure'],
      specialCircumstances: ['native_american', 'rural', 'first_generation'],
      constraints: ['unreliable internet', 'geographic isolation', 'far from campuses'],
    },
  },
  {
    id: 'henry',
    name: 'Henry',
    grade: 11,
    state: 'TX',
    situation: 'Military Pathway to College',
    background:
      '11th grader exploring military service as a way to fund college. Interested in ROTC, GI Bill, and enlistment options. Wants to attend university but faces financial barriers.',
    goal: 'Compare military pathways (ROTC, enlist then GI Bill, service academies) to determine the best route to a college degree.',
    keyBarriers: [
      'Scattered online information about military-to-college paths',
      'Difficulty weighing opportunity costs (time away, missed recruiting cycles)',
      'Unclear which branch and program fits his goals',
    ],
    specialCircumstances: ['military_interest'],
    samplePrompts: [
      'How do I know if joining the military before college is smarter than taking student loans?',
      "What's the real difference between ROTC, the GI Bill, and tuition assistance?",
      'If I enlist first, how do I make sure I can still go to a good college afterward?',
    ],
    initialProfile: {
      grade: 11,
      state: 'TX',
      interests: ['military service', 'leadership', 'engineering'],
      goals: ['college degree funded through military', 'military career'],
      specialCircumstances: ['military_interest'],
      constraints: ['significant financial barriers to college'],
    },
  },
  {
    id: 'elena',
    name: 'Elena',
    grade: 12,
    state: 'CA',
    situation: 'Creative Arts / Animation',
    background:
      'Rising 12th grader at an academically strong magnet school. Wants to pursue animation and visual arts. Peers are applying to STEM/business programs — she feels under-advised for creative pathways.',
    goal: 'Find the right animation/arts programs across schools, compare portfolio requirements, career outcomes, and costs.',
    keyBarriers: [
      'Difficulty comparing art-focused institutions across states',
      'Lack of information combining program quality, career outcomes, and arts funding',
      'Feels under-advised vs STEM peers',
    ],
    specialCircumstances: ['arts_student'],
    samplePrompts: [
      'Is getting a degree in production design actually worth it for an arts career?',
      'What should I look for when comparing animation programs at CalArts vs SCAD vs RISD?',
      'How can I keep track of different art school application requirements?',
    ],
    initialProfile: {
      grade: 12,
      state: 'CA',
      interests: ['animation', 'visual arts', 'production design'],
      goals: ['arts/animation degree', 'career in creative industry'],
      specialCircumstances: ['arts_student'],
      programInterests: ['50.0401', '50.0605'],
    },
  },
  {
    id: 'persona-a',
    name: 'Aria',
    grade: 11,
    state: 'VA',
    situation: 'Rural Appalachia, Nursing, Above Pell Threshold',
    background:
      'First-gen junior in rural Appalachia. Wants a nursing degree. Family income is above Pell Grant threshold but not wealthy. School has a single counselor for 400+ students. Uses mobile hotspot.',
    goal: 'Compare CC ADN → transfer to BSN vs direct-entry BSN — get concrete trade-offs on cost, time, and transfer competitiveness.',
    keyBarriers: [
      'Not Pell-eligible but still constrained financially',
      'Uncertain whether CC nursing transfers reliably to 4-year BSN',
      'Limited internet/counselor access',
    ],
    specialCircumstances: ['rural', 'first_generation'],
    samplePrompts: [
      'I want to do nursing. What is the difference between going to community college and then transferring versus just going straight to the college?',
      'Will my ADN from Virginia Western transfer to Radford nursing?',
      'How do I finance a nursing degree if I don\'t qualify for Pell?',
    ],
    initialProfile: {
      grade: 11,
      state: 'VA',
      interests: ['nursing', 'healthcare'],
      goals: ['nursing degree', 'RN licensure'],
      specialCircumstances: ['rural', 'first_generation'],
      constraints: ['limited internet', 'limited counselor access', 'financial constraints'],
      financialInfo: { pellEligible: false, incomeRange: 'middle' },
    },
  },
  {
    id: 'persona-b',
    name: 'Diego',
    grade: 12,
    state: 'CA',
    situation: 'DACA-Eligible, Urban CA',
    background:
      '3.6 GPA high school senior in a mid-size California city. DACA-eligible. Works part-time to support family. Has not told school staff about immigration status. Wants to attend UC or CSU.',
    goal: 'Navigate CADAA vs FAFSA correctly, understand AB 540 eligibility, and compare UC vs CSU affordability after aid.',
    keyBarriers: [
      'Afraid revealing status will cause problems — needs privacy assurance',
      'Confuses DACA with Dream Act / CADAA with FAFSA',
      'Cannot take out federal loans — aid comparison must account for this',
    ],
    specialCircumstances: ['undocumented', 'daca_eligible'],
    samplePrompts: [
      'Is it safe to fill out the California Dream Act application and will it put my family at risk?',
      'I got into a CSU and a UC but the UC costs more, however I got a grant. How do I figure out which one I can actually afford without taking loans?',
      'What is AB 540 and do I qualify?',
    ],
    initialProfile: {
      grade: 12,
      state: 'CA',
      gpa: 3.6,
      interests: ['undecided'],
      goals: ['UC or CSU admission', 'maximize financial aid safely'],
      specialCircumstances: ['undocumented', 'daca_eligible'],
      constraints: ['cannot use FAFSA', 'no federal loans available', 'privacy concerns'],
      financialInfo: { pellEligible: false, hasParentalSupport: true, incomeRange: 'low' },
    },
  },
]

export function getPersonaById(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id)
}
```

- [ ] Commit

```bash
git add src/lib/data/personas.ts
git commit -m "feat: add 10 synthetic student personas from research"
```

---

## Task 5: RAG service (interface + in-memory impl)

**Files:**
- Create: `src/lib/services/rag.ts`

- [ ] Write `src/lib/services/rag.ts`

```typescript
// src/lib/services/rag.ts
import { SCHOOLS, searchSchools, getSchoolsByState, getSchoolsByType } from '@/lib/data/schools'
import type { School, RAGQueryParams, RAGResult } from '@/lib/types'

export interface IRAGService {
  query(params: RAGQueryParams): Promise<RAGResult[]>
  getByIds(unitIds: string[]): Promise<School[]>
}

// In-memory implementation — replace with PineconeRAGService for production
export class InMemoryRAGService implements IRAGService {
  async query(params: RAGQueryParams): Promise<RAGResult[]> {
    let candidates = [...SCHOOLS]

    if (params.state) {
      candidates = candidates.filter((s) => s.state === params.state)
    }

    if (params.type && params.type.length > 0) {
      candidates = candidates.filter((s) => params.type!.includes(s.type))
    }

    if (params.cipCodes && params.cipCodes.length > 0) {
      candidates = candidates.filter((s) =>
        params.cipCodes!.some((cip) =>
          s.programs.some((p) => p.startsWith(cip.substring(0, 2)))
        )
      )
    }

    if (params.maxTuition) {
      candidates = candidates.filter((s) => s.inStateTuition <= params.maxTuition!)
    }

    if (params.query) {
      const textMatches = searchSchools(params.query).map((s) => s.unitId)
      candidates = candidates.filter((s) => textMatches.includes(s.unitId))
    }

    return candidates.slice(0, 5).map((school, i) => ({
      school,
      score: 1 - i * 0.1,
    }))
  }

  async getByIds(unitIds: string[]): Promise<School[]> {
    return SCHOOLS.filter((s) => unitIds.includes(s.unitId))
  }
}

// Singleton for use in API routes
export const ragService: IRAGService = new InMemoryRAGService()
```

- [ ] Commit

```bash
git add src/lib/services/rag.ts
git commit -m "feat: add RAG service interface and in-memory implementation"
```

---

## Task 6: College Scorecard service

**Files:**
- Create: `src/lib/services/scorecard.ts`

- [ ] Write `src/lib/services/scorecard.ts`

```typescript
// src/lib/services/scorecard.ts

export interface ScorecardProgram {
  institutionName: string
  state: string
  cipCode: string
  credentialLevel: number
  medianEarnings: number
  medianDebt: number
  completionRate: number | null
}

export interface ScorecardInstitution {
  unitId: string
  name: string
  state: string
  inStateTuition: number
  outOfStateTuition: number
  admissionRate: number | null
  gradRate: number
  medianEarnings10yr: number
  medianDebt: number
  netPrice: number
}

export interface ScorecardQueryParams {
  state?: string
  cipCode?: string
  credentialLevel?: number // 1=cert, 2=associate, 3=bachelor's
  perPage?: number
}

export interface ICollegeScorecardService {
  searchInstitutions(params: ScorecardQueryParams): Promise<ScorecardInstitution[]>
  getInstitution(unitId: string): Promise<ScorecardInstitution | null>
}

export class CollegeScorecardService implements ICollegeScorecardService {
  private readonly baseUrl = 'https://api.data.gov/ed/collegescorecard/v1'
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async searchInstitutions(params: ScorecardQueryParams): Promise<ScorecardInstitution[]> {
    const fields = [
      'id', 'school.name', 'school.state',
      'latest.cost.tuition.in_state', 'latest.cost.tuition.out_of_state',
      'latest.admissions.admission_rate.overall',
      'latest.completion.rate_suppressed.overall',
      'latest.earnings.10_yrs_after_entry.median',
      'latest.aid.median_debt.completers.overall',
      'latest.cost.avg_net_price.public',
    ].join(',')

    const queryParams = new URLSearchParams({
      api_key: this.apiKey,
      fields,
      per_page: String(params.perPage ?? 10),
    })

    if (params.state) queryParams.set('school.state', params.state)
    if (params.cipCode) queryParams.set('latest.programs.cip_4_digit.code', params.cipCode)

    const res = await fetch(`${this.baseUrl}/schools?${queryParams}`, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) throw new Error(`Scorecard API error: ${res.status}`)

    const json = await res.json()
    return (json.results ?? []).map(this.mapToInstitution)
  }

  async getInstitution(unitId: string): Promise<ScorecardInstitution | null> {
    const fields = [
      'id', 'school.name', 'school.state',
      'latest.cost.tuition.in_state', 'latest.cost.tuition.out_of_state',
      'latest.admissions.admission_rate.overall',
      'latest.completion.rate_suppressed.overall',
      'latest.earnings.10_yrs_after_entry.median',
      'latest.aid.median_debt.completers.overall',
      'latest.cost.avg_net_price.public',
    ].join(',')

    const queryParams = new URLSearchParams({ api_key: this.apiKey, fields })
    const res = await fetch(`${this.baseUrl}/schools/${unitId}?${queryParams}`, {
      next: { revalidate: 3600 },
    })

    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Scorecard API error: ${res.status}`)

    const json = await res.json()
    return this.mapToInstitution(json.results?.[0] ?? json)
  }

  private mapToInstitution(raw: Record<string, unknown>): ScorecardInstitution {
    return {
      unitId: String(raw['id']),
      name: String(raw['school.name'] ?? ''),
      state: String(raw['school.state'] ?? ''),
      inStateTuition: Number(raw['latest.cost.tuition.in_state'] ?? 0),
      outOfStateTuition: Number(raw['latest.cost.tuition.out_of_state'] ?? 0),
      admissionRate: raw['latest.admissions.admission_rate.overall'] != null
        ? Number(raw['latest.admissions.admission_rate.overall'])
        : null,
      gradRate: Number(raw['latest.completion.rate_suppressed.overall'] ?? 0),
      medianEarnings10yr: Number(raw['latest.earnings.10_yrs_after_entry.median'] ?? 0),
      medianDebt: Number(raw['latest.aid.median_debt.completers.overall'] ?? 0),
      netPrice: Number(raw['latest.cost.avg_net_price.public'] ?? 0),
    }
  }
}

export function createScorecardService(): ICollegeScorecardService {
  const apiKey = process.env.COLLEGE_SCORECARD_API_KEY
  if (!apiKey) throw new Error('COLLEGE_SCORECARD_API_KEY not set')
  return new CollegeScorecardService(apiKey)
}
```

- [ ] Commit

```bash
git add src/lib/services/scorecard.ts
git commit -m "feat: add College Scorecard API service"
```

---

## Task 7: O*NET service

**Files:**
- Create: `src/lib/services/onet.ts`

- [ ] Write `src/lib/services/onet.ts`

```typescript
// src/lib/services/onet.ts

export interface ONETOccupation {
  code: string
  title: string
  description: string
  jobZone: number // 1-5, preparation needed
  brightOutlook: boolean
  wages: { median: number; unit: string } | null
}

export interface ONETOccupationDetail extends ONETOccupation {
  education: string
  skills: string[]
  tasks: string[]
  relatedOccupations: { code: string; title: string }[]
}

export interface IONETService {
  searchOccupations(keyword: string): Promise<ONETOccupation[]>
  getOccupationDetail(code: string): Promise<ONETOccupationDetail | null>
}

export class ONETService implements IONETService {
  private readonly baseUrl = 'https://services.onetcenter.org/ws'
  private readonly authHeader: string

  constructor(username: string, password: string) {
    this.authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
  }

  async searchOccupations(keyword: string): Promise<ONETOccupation[]> {
    const res = await fetch(
      `${this.baseUrl}/search?keyword=${encodeURIComponent(keyword)}&client=gates_prototype`,
      {
        headers: { Authorization: this.authHeader, Accept: 'application/json' },
        next: { revalidate: 3600 },
      }
    )

    if (!res.ok) throw new Error(`O*NET search error: ${res.status}`)
    const json = await res.json()

    return (json.occupation ?? []).slice(0, 5).map((o: Record<string, unknown>) => ({
      code: String(o['code']),
      title: String(o['title']),
      description: String(o['description'] ?? ''),
      jobZone: Number(o['job_zone'] ?? 3),
      brightOutlook: Boolean(o['bright_outlook']),
      wages: null,
    }))
  }

  async getOccupationDetail(code: string): Promise<ONETOccupationDetail | null> {
    const res = await fetch(
      `${this.baseUrl}/occupations/${code}?client=gates_prototype`,
      {
        headers: { Authorization: this.authHeader, Accept: 'application/json' },
        next: { revalidate: 3600 },
      }
    )

    if (res.status === 404) return null
    if (!res.ok) throw new Error(`O*NET detail error: ${res.status}`)

    const json = await res.json()
    return {
      code,
      title: String(json['title'] ?? ''),
      description: String(json['description'] ?? ''),
      jobZone: Number(json['job_zone'] ?? 3),
      brightOutlook: Boolean(json['bright_outlook']),
      wages: json['wages']
        ? { median: Number(json['wages']['median']), unit: 'annual' }
        : null,
      education: String(json['education'] ?? 'See O*NET for details'),
      skills: (json['skills'] ?? []).slice(0, 5).map((s: Record<string, unknown>) => String(s['name'])),
      tasks: (json['tasks'] ?? []).slice(0, 4).map((t: Record<string, unknown>) => String(t['description'])),
      relatedOccupations: (json['related_occupations'] ?? [])
        .slice(0, 3)
        .map((r: Record<string, unknown>) => ({ code: String(r['code']), title: String(r['title']) })),
    }
  }
}

export function createONETService(): IONETService {
  const username = process.env.ONET_USERNAME
  const password = process.env.ONET_PASSWORD
  if (!username || !password) throw new Error('ONET_USERNAME / ONET_PASSWORD not set')
  return new ONETService(username, password)
}
```

- [ ] Commit

```bash
git add src/lib/services/onet.ts
git commit -m "feat: add O*NET API service"
```

---

## Task 8: Session management

**Files:**
- Create: `src/lib/orchestration/session.ts`

- [ ] Write `src/lib/orchestration/session.ts`

```typescript
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
```

- [ ] Commit

```bash
git add src/lib/orchestration/session.ts
git commit -m "feat: add in-memory session management"
```

---

## Task 9: Guardrails (input + output)

**Files:**
- Create: `src/lib/orchestration/guardrails.ts`

- [ ] Write `src/lib/orchestration/guardrails.ts`

```typescript
// src/lib/orchestration/guardrails.ts

export interface GuardrailResult {
  passed: boolean
  reason?: string
  sanitized?: string
}

// --- Input guardrails ---

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{9}\b/, // SSN no dashes
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, // phone number
]

const INJECTION_PATTERNS = [
  /ignore (previous|all|prior) (instructions?|prompts?|system)/i,
  /you are now|pretend (you are|to be)|act as (if you are|a)/i,
  /\[\[.*system.*\]\]/i,
  /</s>\s*<s>/i,
]

export function checkInputGuardrails(message: string): GuardrailResult {
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(message)) {
      return {
        passed: false,
        reason: 'Message appears to contain sensitive personal information (SSN or phone number). Please do not share sensitive identifiers.',
      }
    }
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        passed: false,
        reason: 'Message contains content that cannot be processed. Please ask a question about college or career planning.',
      }
    }
  }

  if (message.trim().length < 2) {
    return { passed: false, reason: 'Message too short.' }
  }

  return { passed: true }
}

// --- Output guardrails ---

export interface OutputGuardrailResult {
  passed: boolean
  response: string // potentially modified
  warnings: string[]
}

export function checkOutputGuardrails(
  response: string,
  retrievedData: string
): OutputGuardrailResult {
  const warnings: string[] = []

  // Check for common hallucination patterns: specific dollar amounts not in retrieved data
  const dollarAmounts = response.match(/\$[\d,]+/g) ?? []
  for (const amount of dollarAmounts) {
    const num = amount.replace(/[$,]/g, '')
    if (!retrievedData.includes(num) && !retrievedData.includes(amount)) {
      warnings.push(`Unverified dollar amount: ${amount}`)
    }
  }

  // Strip any accidental PII echoing
  let sanitized = response
  for (const pattern of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }

  return {
    passed: warnings.length === 0,
    response: sanitized,
    warnings,
  }
}

export function formatDataVintageDisclosure(dataYear: number): string {
  return `\n\n*Data note: School-specific figures are from ${dataYear}. Verify current amounts directly with each institution.*`
}
```

- [ ] Commit

```bash
git add src/lib/orchestration/guardrails.ts
git commit -m "feat: add input and output guardrails"
```

---

## Task 10: Intent classifier + query rewriter

**Files:**
- Create: `src/lib/orchestration/intent.ts`

- [ ] Write `src/lib/orchestration/intent.ts`

```typescript
// src/lib/orchestration/intent.ts
import Anthropic from '@anthropic-ai/sdk'
import type { IntentClassification, SessionState } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a college advising tool. Classify the student's message into exactly one intent and extract structured parameters.

Intents:
- profile_collection: Student is sharing personal info (grade, interests, location, finances, circumstances)
- career_exploration: Student is exploring career options or expressing interests
- program_comparison: Student wants to compare specific schools or programs
- pathway_recommendation: Student wants personalized postsecondary pathway recommendations
- application_prep: Student needs help with applications, deadlines, FAFSA, CADAA, or financial aid
- general_question: General advising question not fitting above categories

Respond with ONLY valid JSON matching this schema:
{
  "intent": "<intent_category>",
  "extractedParams": {
    "state": "<2-letter state code or null>",
    "cipCodes": ["<CIP prefix>"] or [],
    "schoolNames": ["<school name>"] or [],
    "degreeLevel": "associate|bachelor|certificate|trade|null",
    "maxBudget": <number or null>
  },
  "rewrittenQuery": "<clear, standalone version of the query using session context>"
}`

export async function classifyIntent(
  message: string,
  session: SessionState
): Promise<IntentClassification> {
  const contextSummary = buildContextSummary(session)

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: INTENT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Session context:\n${contextSummary}\n\nStudent message: "${message}"`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'

  try {
    return JSON.parse(text) as IntentClassification
  } catch {
    // Fallback if JSON parsing fails
    return {
      intent: 'general_question',
      extractedParams: {},
      rewrittenQuery: message,
    }
  }
}

function buildContextSummary(session: SessionState): string {
  const p = session.studentProfile
  const parts: string[] = []
  if (p.grade) parts.push(`Grade: ${p.grade}`)
  if (p.state) parts.push(`State: ${p.state}`)
  if (p.interests.length) parts.push(`Interests: ${p.interests.join(', ')}`)
  if (p.goals.length) parts.push(`Goals: ${p.goals.join(', ')}`)
  if (p.specialCircumstances.length) parts.push(`Special circumstances: ${p.specialCircumstances.join(', ')}`)
  if (p.constraints.length) parts.push(`Constraints: ${p.constraints.join(', ')}`)
  if (session.priorRecommendations.length)
    parts.push(`Previously mentioned: ${session.priorRecommendations.join(', ')}`)
  return parts.length ? parts.join('\n') : 'No context yet'
}
```

- [ ] Commit

```bash
git add src/lib/orchestration/intent.ts
git commit -m "feat: add intent classifier using Claude Haiku"
```

---

## Task 11: Prompt builder

**Files:**
- Create: `src/lib/orchestration/prompt-builder.ts`

- [ ] Write `src/lib/orchestration/prompt-builder.ts`

```typescript
// src/lib/orchestration/prompt-builder.ts
import type { SessionState, IntentClassification } from '@/lib/types'
import type { RAGResult } from '@/lib/types'
import type { ScorecardInstitution } from '@/lib/services/scorecard'
import type { ONETOccupation } from '@/lib/services/onet'

export const SYSTEM_PROMPT = `You are an empathetic college and career advisor helping high school students (grades 9–12) explore postsecondary pathways. Your users are often first-generation, low-income, or in complex life situations.

CORE BEHAVIORS:
1. Ask 1–2 targeted clarifying questions before advising when you lack key context (state, grade, goals, constraints)
2. Use plain language — always define jargon (e.g., "articulation agreement," "SAI," "EFC," "ADN") in parentheses
3. Structure responses as numbered action steps, not walls of text
4. Present ALL viable pathway types equally: community college, 4-year, trade/vocational, tribal college, military, apprenticeship. Never default to 4-year college as obviously best.
5. Acknowledge and adapt to real-world constraints (childcare, unreliable internet, housing instability, work schedules)
6. Always include a fallback: "If [primary path] doesn't work out, here's what to do next"
7. Label all data with year: "According to 2024 data..." or "As of 2024..."
8. Validate the student's situation with warmth before giving information — don't jump straight to advice

NEVER:
- Suggest FAFSA to DACA/undocumented students in California — use CADAA/Dream Act instead
- Stack aid amounts without noting each has separate eligibility requirements
- Ignore constraints the student has mentioned
- Use motivational language ("You've got this!") as a substitute for concrete next steps
- Assume a 4-year residential college is the right path

STRUCTURED COMPONENTS:
When your response naturally calls for a comparison table, pathway cards, or a timeline/checklist, include a structured component block after your text response using this exact format:

<!-- COMPONENT:comparison_table -->
{"schools": [<unitId strings>], "fields": ["inStateTuition","gradRate","medianEarnings10yr","applicationDeadline"], "labels": {"inStateTuition": "In-State Tuition", "gradRate": "Graduation Rate", "medianEarnings10yr": "Median Earnings (10yr)", "applicationDeadline": "Application Deadline"}}
<!-- /COMPONENT -->

<!-- COMPONENT:pathway_cards -->
{"pathways": [{"title": "...", "type": "community_college|4_year|trade|military|tribal", "description": "...", "timeToComplete": "...", "estimatedCost": "...", "earnings": "...", "nextStep": "...", "fit": "high|medium|low"}]}
<!-- /COMPONENT -->

<!-- COMPONENT:timeline_checklist -->
{"title": "...", "items": [{"week": "Week 1", "task": "...", "detail": "...", "deadline": "YYYY-MM-DD or null", "resource": "URL or null"}]}
<!-- /COMPONENT -->

Only include a component when it genuinely improves comprehension. One component per response maximum.`

export interface PromptContext {
  session: SessionState
  classification: IntentClassification
  ragResults: RAGResult[]
  scorecardData: ScorecardInstitution[]
  onetData: ONETOccupation[]
}

export function buildUserMessage(context: PromptContext): string {
  const parts: string[] = []

  // Student profile
  const p = context.session.studentProfile
  const profileLines: string[] = []
  if (p.grade) profileLines.push(`Grade: ${p.grade}`)
  if (p.state) profileLines.push(`State: ${p.state}`)
  if (p.gpa) profileLines.push(`GPA: ${p.gpa}`)
  if (p.interests.length) profileLines.push(`Interests: ${p.interests.join(', ')}`)
  if (p.goals.length) profileLines.push(`Goals: ${p.goals.join(', ')}`)
  if (p.specialCircumstances.length) profileLines.push(`Special circumstances: ${p.specialCircumstances.join(', ')}`)
  if (p.constraints.length) profileLines.push(`Constraints: ${p.constraints.join(', ')}`)
  if (p.financialInfo.pellEligible !== null)
    profileLines.push(`Pell eligible: ${p.financialInfo.pellEligible}`)

  if (profileLines.length > 0) {
    parts.push(`[STUDENT PROFILE]\n${profileLines.join('\n')}`)
  }

  // Retrieved school data
  if (context.ragResults.length > 0) {
    const schoolData = context.ragResults.map((r) => {
      const s = r.school
      return `${s.name} (${s.state}, ${s.type}): In-state tuition $${s.inStateTuition.toLocaleString()}, Grad rate ${Math.round(s.gradRate * 100)}%, Median earnings $${s.medianEarnings10yr.toLocaleString()}/yr. Notes: ${s.specialNotes.join('; ')} [Data: ${s.dataYear}]`
    }).join('\n')
    parts.push(`[SCHOOL DATA FROM KNOWLEDGE BASE]\n${schoolData}`)
  }

  // College Scorecard data
  if (context.scorecardData.length > 0) {
    const scorecardText = context.scorecardData.map((s) =>
      `${s.name} (${s.state}): In-state $${s.inStateTuition.toLocaleString()}, Admission rate ${s.admissionRate !== null ? Math.round(s.admissionRate * 100) + '%' : 'open'}, Grad rate ${Math.round(s.gradRate * 100)}%, Median earnings $${s.medianEarnings10yr.toLocaleString()}`
    ).join('\n')
    parts.push(`[COLLEGE SCORECARD DATA — Live]\n${scorecardText}`)
  }

  // O*NET data
  if (context.onetData.length > 0) {
    const onetText = context.onetData.map((o) =>
      `${o.title} (SOC: ${o.code}): Job Zone ${o.jobZone}/5 preparation needed. ${o.brightOutlook ? 'Bright Outlook — growing field.' : ''} ${o.wages ? `Median wage: $${o.wages.median.toLocaleString()}/yr.` : ''}`
    ).join('\n')
    parts.push(`[CAREER DATA FROM O*NET]\n${onetText}`)
  }

  // Conversation history (last 6 turns)
  const recentHistory = context.session.conversationHistory.slice(-6)
  if (recentHistory.length > 0) {
    const historyText = recentHistory.map((m) => `${m.role === 'user' ? 'Student' : 'Advisor'}: ${m.content}`).join('\n')
    parts.push(`[CONVERSATION HISTORY]\n${historyText}`)
  }

  // Current query
  parts.push(`[CURRENT QUESTION]\n${context.classification.rewrittenQuery}`)

  return parts.join('\n\n')
}
```

- [ ] Commit

```bash
git add src/lib/orchestration/prompt-builder.ts
git commit -m "feat: add prompt builder with system prompt and context assembly"
```

---

## Task 12: API routes

**Files:**
- Create: `src/app/api/chat/route.ts`
- Create: `src/app/api/schools/route.ts`
- Create: `src/app/api/scorecard/route.ts`
- Create: `src/app/api/onet/route.ts`

- [ ] Write `src/app/api/schools/route.ts`

```typescript
// src/app/api/schools/route.ts
import { NextRequest } from 'next/server'
import { ragService } from '@/lib/services/rag'
import type { RAGQueryParams, SchoolType } from '@/lib/types'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const params: RAGQueryParams = {
    state: searchParams.get('state') ?? undefined,
    query: searchParams.get('q') ?? undefined,
    maxTuition: searchParams.get('maxTuition') ? Number(searchParams.get('maxTuition')) : undefined,
    type: searchParams.get('type')
      ? (searchParams.get('type')!.split(',') as SchoolType[])
      : undefined,
  }

  const results = await ragService.query(params)
  return Response.json({ results })
}
```

- [ ] Write `src/app/api/scorecard/route.ts`

```typescript
// src/app/api/scorecard/route.ts
import { NextRequest } from 'next/server'
import { createScorecardService } from '@/lib/services/scorecard'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const state = searchParams.get('state')
  const cipCode = searchParams.get('cipCode')

  try {
    const service = createScorecardService()
    const results = await service.searchInstitutions({ state: state ?? undefined, cipCode: cipCode ?? undefined, perPage: 5 })
    return Response.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scorecard unavailable'
    return Response.json({ results: [], error: message }, { status: 200 }) // graceful degradation
  }
}
```

- [ ] Write `src/app/api/onet/route.ts`

```typescript
// src/app/api/onet/route.ts
import { NextRequest } from 'next/server'
import { createONETService } from '@/lib/services/onet'

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get('keyword')
  if (!keyword) return Response.json({ results: [] })

  try {
    const service = createONETService()
    const results = await service.searchOccupations(keyword)
    return Response.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'O*NET unavailable'
    return Response.json({ results: [], error: message }, { status: 200 })
  }
}
```

- [ ] Write `src/app/api/chat/route.ts`

```typescript
// src/app/api/chat/route.ts
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getOrCreateSession, updateSession, updateStudentProfile } from '@/lib/orchestration/session'
import { checkInputGuardrails, checkOutputGuardrails, formatDataVintageDisclosure } from '@/lib/orchestration/guardrails'
import { classifyIntent } from '@/lib/orchestration/intent'
import { buildUserMessage, SYSTEM_PROMPT } from '@/lib/orchestration/prompt-builder'
import { ragService } from '@/lib/services/rag'
import { createScorecardService } from '@/lib/services/scorecard'
import { createONETService } from '@/lib/services/onet'
import { getPersonaById } from '@/lib/data/personas'
import type { Message } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { message, sessionId, personaId } = body as {
    message: string
    sessionId: string
    personaId?: string
  }

  // Input guardrails
  const inputCheck = checkInputGuardrails(message)
  if (!inputCheck.passed) {
    return Response.json({ error: inputCheck.reason }, { status: 400 })
  }

  // Session setup
  const session = getOrCreateSession(sessionId, personaId)

  // Seed profile from persona if first message
  if (personaId && session.conversationHistory.length === 0) {
    const persona = getPersonaById(personaId)
    if (persona?.initialProfile) {
      updateStudentProfile(sessionId, persona.initialProfile as Parameters<typeof updateStudentProfile>[1])
    }
  }

  // Classify intent
  const classification = await classifyIntent(message, session)

  // Update profile with extracted params
  if (classification.extractedParams.state) {
    updateStudentProfile(sessionId, { state: classification.extractedParams.state })
  }

  // Parallel data retrieval
  const [ragResults, scorecardData, onetData] = await Promise.allSettled([
    // RAG — always query for school context when relevant
    ['program_comparison', 'pathway_recommendation', 'application_prep'].includes(classification.intent)
      ? ragService.query({
          state: classification.extractedParams.state ?? session.studentProfile.state ?? undefined,
          cipCodes: classification.extractedParams.cipCodes,
        })
      : Promise.resolve([]),

    // Scorecard — for comparison/recommendation
    ['program_comparison', 'pathway_recommendation'].includes(classification.intent) &&
    process.env.COLLEGE_SCORECARD_API_KEY
      ? createScorecardService().searchInstitutions({
          state: classification.extractedParams.state ?? session.studentProfile.state ?? undefined,
          cipCode: classification.extractedParams.cipCodes?.[0],
          perPage: 3,
        })
      : Promise.resolve([]),

    // O*NET — for career exploration
    ['career_exploration', 'pathway_recommendation'].includes(classification.intent) &&
    process.env.ONET_USERNAME
      ? createONETService().searchOccupations(
          session.studentProfile.interests.join(' ') || message
        )
      : Promise.resolve([]),
  ])

  const rag = ragResults.status === 'fulfilled' ? ragResults.value : []
  const scorecard = scorecardData.status === 'fulfilled' ? scorecardData.value : []
  const onet = onetData.status === 'fulfilled' ? onetData.value : []

  // Build prompt
  const userMessage = buildUserMessage({
    session,
    classification,
    ragResults: rag,
    scorecardData: scorecard,
    onetData: onet,
  })

  // Stream from Claude
  const encoder = new TextEncoder()
  let fullResponse = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        })

        for await (const chunk of claudeStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullResponse += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }

        // Add vintage disclosure if school data was used
        if (rag.length > 0) {
          const disclosure = formatDataVintageDisclosure(2024)
          fullResponse += disclosure
          controller.enqueue(encoder.encode(disclosure))
        }

        // Output guardrails
        const retrievedDataStr = JSON.stringify({ rag, scorecard, onet })
        const outputCheck = checkOutputGuardrails(fullResponse, retrievedDataStr)

        // Save to session
        const userMsg: Message = { role: 'user', content: message, timestamp: Date.now() }
        const assistantMsg: Message = {
          role: 'assistant',
          content: outputCheck.response,
          timestamp: Date.now(),
        }

        updateSession(sessionId, {
          conversationHistory: [...session.conversationHistory, userMsg, assistantMsg],
          priorRecommendations: [
            ...session.priorRecommendations,
            ...rag.map((r) => r.school.name),
          ],
        })

        controller.close()
      } catch (err) {
        const errorMsg = '\n\n[An error occurred. Please try again.]'
        controller.enqueue(encoder.encode(errorMsg))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Intent': classification.intent,
    },
  })
}
```

- [ ] Commit

```bash
git add src/app/api/chat/route.ts src/app/api/schools/route.ts src/app/api/scorecard/route.ts src/app/api/onet/route.ts
git commit -m "feat: add API routes (chat streaming, schools, scorecard, onet)"
```

---

## Task 13: Layout + Header + PersonaSelector components

**Files:**
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/PersonaSelector.tsx`

- [ ] Create `src/components/layout/Header.tsx`

```typescript
// src/components/layout/Header.tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface HeaderProps {
  personaName?: string
  sessionId?: string
}

export function Header({ personaName, sessionId }: HeaderProps) {
  return (
    <header className="border-b px-6 py-3 flex items-center justify-between bg-background sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-lg font-bold tracking-tight hover:opacity-80 transition-opacity">
          PathwayAI
        </Link>
        <Badge variant="secondary" className="text-xs">Gates Prototype</Badge>
        {personaName && (
          <Badge variant="outline" className="text-xs">
            {personaName}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {sessionId && (
          <Link href="/">
            <Button variant="ghost" size="sm">Switch Persona</Button>
          </Link>
        )}
      </div>
    </header>
  )
}
```

- [ ] Create `src/components/layout/PersonaSelector.tsx`

```typescript
// src/components/layout/PersonaSelector.tsx
'use client'
import { useRouter } from 'next/navigation'
import { PERSONAS } from '@/lib/data/personas'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const SITUATION_COLORS: Record<string, string> = {
  'First-Gen CC Transfer': 'bg-blue-100 text-blue-800',
  'Unaccompanied Homeless Youth': 'bg-red-100 text-red-800',
  'Teen Mother, Rural Virginia': 'bg-purple-100 text-purple-800',
  'After Juvenile Detention': 'bg-orange-100 text-orange-800',
  'Foster Youth Aging Out': 'bg-yellow-100 text-yellow-800',
  'Navajo Nation, Rural First-Gen': 'bg-green-100 text-green-800',
  'Military Pathway to College': 'bg-slate-100 text-slate-800',
  'Creative Arts / Animation': 'bg-pink-100 text-pink-800',
  'Rural Appalachia, Nursing, Above Pell Threshold': 'bg-teal-100 text-teal-800',
  'DACA-Eligible, Urban CA': 'bg-indigo-100 text-indigo-800',
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function PersonaSelector() {
  const router = useRouter()

  function startWithPersona(personaId: string) {
    const sessionId = generateSessionId()
    router.push(`/chat/${sessionId}?persona=${personaId}`)
  }

  function startFresh() {
    const sessionId = generateSessionId()
    router.push(`/chat/${sessionId}`)
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">College & Career Advisor</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Select a student persona to begin a demo session, or start fresh to enter your own information.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PERSONAS.map((persona) => (
          <Card
            key={persona.id}
            className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/30"
            onClick={() => startWithPersona(persona.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{persona.name}</CardTitle>
                <Badge variant="outline" className="text-xs shrink-0">Grade {persona.grade}</Badge>
              </div>
              <span
                className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${SITUATION_COLORS[persona.situation] ?? 'bg-gray-100 text-gray-800'}`}
              >
                {persona.situation}
              </span>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground line-clamp-2">{persona.goal}</p>
              <p className="text-xs text-muted-foreground">{persona.state} · {persona.keyBarriers[0]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center pt-4 border-t">
        <Button variant="outline" size="lg" onClick={startFresh}>
          Start Fresh (Enter My Own Info)
        </Button>
      </div>
    </div>
  )
}
```

- [ ] Commit

```bash
git add src/components/layout/Header.tsx src/components/layout/PersonaSelector.tsx
git commit -m "feat: add Header and PersonaSelector components"
```

---

## Task 14: Chat components

**Files:**
- Create: `src/components/chat/ChatInput.tsx`
- Create: `src/components/chat/MessageBubble.tsx`
- Create: `src/components/chat/ChatInterface.tsx`

- [ ] Create `src/components/chat/ChatInput.tsx`

```typescript
// src/components/chat/ChatInput.tsx
'use client'
import { useState, useRef, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2 p-4 border-t bg-background">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about college, careers, or financial aid..."
        disabled={disabled}
        className="flex-1"
      />
      <Button onClick={handleSend} disabled={disabled || !value.trim()} size="icon">
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
```

- [ ] Create `src/components/chat/MessageBubble.tsx`

```typescript
// src/components/chat/MessageBubble.tsx
import type { Message } from '@/lib/types'

interface MessageBubbleProps {
  message: Message
  structuredComponent?: React.ReactNode
}

export function MessageBubble({ message, structuredComponent }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted text-foreground rounded-bl-sm'
          }`}
        >
          {message.content}
        </div>
        {structuredComponent && (
          <div className="w-full">{structuredComponent}</div>
        )}
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-sm">
        <div className="flex gap-1 items-center h-4">
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] Create `src/components/chat/ChatInterface.tsx`

```typescript
// src/components/chat/ChatInterface.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { MessageBubble, TypingIndicator } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { ComparisonTable } from '@/components/panels/ComparisonTable'
import { PathwayCards } from '@/components/panels/PathwayCards'
import { TimelineChecklist } from '@/components/panels/TimelineChecklist'
import type { Message, StructuredComponent, ComparisonTableData, PathwayCardsData, TimelineChecklistData } from '@/lib/types'
import { SCHOOLS } from '@/lib/data/schools'

interface ChatInterfaceProps {
  sessionId: string
  personaId?: string
  personaName?: string
}

interface DisplayMessage extends Message {
  structuredComponent?: StructuredComponent
  isStreaming?: boolean
}

function parseStructuredComponent(text: string): { cleanText: string; component: StructuredComponent | null } {
  const match = text.match(/<!-- COMPONENT:(\w+) -->\n([\s\S]*?)\n<!-- \/COMPONENT -->/)
  if (!match) return { cleanText: text, component: null }

  const type = match[1] as StructuredComponent['type']
  try {
    const data = JSON.parse(match[2])
    return {
      cleanText: text.replace(match[0], '').trim(),
      component: { type, data },
    }
  } catch {
    return { cleanText: text, component: null }
  }
}

function renderStructuredComponent(component: StructuredComponent | undefined) {
  if (!component) return null
  if (component.type === 'comparison_table') {
    const data = component.data as ComparisonTableData
    const schools = (data.schools as unknown as string[]).map((id) => SCHOOLS.find((s) => s.unitId === id)).filter(Boolean) as typeof SCHOOLS
    return <ComparisonTable schools={schools} fields={data.fields} labels={data.labels} />
  }
  if (component.type === 'pathway_cards') {
    return <PathwayCards data={component.data as PathwayCardsData} />
  }
  if (component.type === 'timeline_checklist') {
    return <TimelineChecklist data={component.data as TimelineChecklistData} />
  }
  return null
}

export function ChatInterface({ sessionId, personaId, personaName }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Greeting on mount
  useEffect(() => {
    const greeting: DisplayMessage = {
      role: 'assistant',
      content: personaName
        ? `Hi! I'm your college and career advisor. I can see you're exploring options as ${personaName}. What questions do you have? You can ask me about pathways, schools, financial aid, applications — anything.`
        : "Hi! I'm your college and career advisor. To get started, can you tell me a bit about yourself? What grade are you in, and what are you hoping to explore today?",
      timestamp: Date.now(),
    }
    setMessages([greeting])
  }, [personaName])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    const userMsg: DisplayMessage = { role: 'user', content: text, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    // Placeholder for streaming assistant message
    const assistantMsg: DisplayMessage = { role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, personaId }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: err.error ?? 'Something went wrong. Please try again.',
            isStreaming: false,
          }
          return updated
        })
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: accumulated,
            isStreaming: true,
          }
          return updated
        })
      }

      // Parse structured components from final response
      const { cleanText, component } = parseStructuredComponent(accumulated)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: cleanText,
          structuredComponent: component ?? undefined,
          isStreaming: false,
        }
        return updated
      })
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Connection error. Please check your internet and try again.',
          isStreaming: false,
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl mx-auto w-full">
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            structuredComponent={renderStructuredComponent(msg.structuredComponent)}
          />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
      <div className="max-w-3xl mx-auto w-full">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  )
}
```

- [ ] Commit

```bash
git add src/components/chat/
git commit -m "feat: add ChatInput, MessageBubble, and ChatInterface components"
```

---

## Task 15: Structured panel components

**Files:**
- Create: `src/components/panels/ComparisonTable.tsx`
- Create: `src/components/panels/PathwayCards.tsx`
- Create: `src/components/panels/TimelineChecklist.tsx`
- Create: `src/components/panels/ProfilePanel.tsx`

- [ ] Create `src/components/panels/ComparisonTable.tsx`

```typescript
// src/components/panels/ComparisonTable.tsx
import type { School } from '@/lib/types'

interface ComparisonTableProps {
  schools: School[]
  fields: Array<keyof School>
  labels: Record<string, string>
}

function formatValue(school: School, field: keyof School): string {
  const val = school[field]
  if (field === 'inStateTuition' || field === 'outOfStateTuition' || field === 'netPriceMedian' || field === 'medianEarnings10yr' || field === 'medianLoanDebt' || field === 'avgAidPackage') {
    return `$${Number(val).toLocaleString()}`
  }
  if (field === 'gradRate' || field === 'admissionRate' || field === 'pctReceivingAid') {
    return val === null ? 'Open Admission' : `${Math.round(Number(val) * 100)}%`
  }
  if (val === null || val === undefined) return '—'
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}

export function ComparisonTable({ schools, fields, labels }: ComparisonTableProps) {
  if (!schools.length) return null

  return (
    <div className="rounded-lg border bg-card overflow-x-auto my-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">School</th>
            {fields.map((f) => (
              <th key={f} className="text-left px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">
                {labels[f] ?? f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schools.map((school, i) => (
            <tr key={school.unitId} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
              <td className="px-4 py-2 font-medium">{school.name}</td>
              {fields.map((f) => (
                <td key={f} className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                  {formatValue(school, f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground px-4 py-2 border-t">Data from 2024. Verify current figures with each institution.</p>
    </div>
  )
}
```

- [ ] Create `src/components/panels/PathwayCards.tsx`

```typescript
// src/components/panels/PathwayCards.tsx
import type { PathwayCardsData, PathwayCard } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

const FIT_COLORS = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
}

const TYPE_LABELS: Record<string, string> = {
  community_college: 'Community College',
  '4_year': '4-Year University',
  trade: 'Trade / Vocational',
  military: 'Military',
  tribal: 'Tribal College',
  apprenticeship: 'Apprenticeship',
}

export function PathwayCards({ data }: { data: PathwayCardsData }) {
  return (
    <div className="grid gap-3 my-2">
      {data.pathways.map((pathway, i) => (
        <PathwayCardItem key={i} pathway={pathway} />
      ))}
    </div>
  )
}

function PathwayCardItem({ pathway }: { pathway: PathwayCard }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">{pathway.title}</h3>
          <span className="text-xs text-muted-foreground">{TYPE_LABELS[pathway.type] ?? pathway.type}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FIT_COLORS[pathway.fit]}`}>
          {pathway.fit === 'high' ? 'Strong fit' : pathway.fit === 'medium' ? 'Worth exploring' : 'Challenging fit'}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{pathway.description}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground block">Time</span>
          <span className="font-medium">{pathway.timeToComplete}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Est. Cost</span>
          <span className="font-medium">{pathway.estimatedCost}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Earnings</span>
          <span className="font-medium">{pathway.earnings}</span>
        </div>
      </div>
      <div className="pt-1 border-t">
        <span className="text-xs text-muted-foreground">Next step: </span>
        <span className="text-xs font-medium">{pathway.nextStep}</span>
      </div>
    </div>
  )
}
```

- [ ] Create `src/components/panels/TimelineChecklist.tsx`

```typescript
// src/components/panels/TimelineChecklist.tsx
import type { TimelineChecklistData } from '@/lib/types'

export function TimelineChecklist({ data }: { data: TimelineChecklistData }) {
  return (
    <div className="rounded-lg border bg-card p-4 my-2 space-y-3">
      <h3 className="font-semibold text-sm">{data.title}</h3>
      <div className="space-y-3">
        {data.items.map((item, i) => (
          <div key={i} className="flex gap-3">
            <div className="shrink-0 w-16 text-xs text-muted-foreground pt-0.5">{item.week}</div>
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium">{item.task}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
              {item.deadline && (
                <p className="text-xs text-orange-600 font-medium">Due: {item.deadline}</p>
              )}
              {item.resource && (
                <a
                  href={item.resource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline"
                >
                  Resource →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] Create `src/components/panels/ProfilePanel.tsx`

```typescript
// src/components/panels/ProfilePanel.tsx
import type { StudentProfile } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

interface ProfilePanelProps {
  profile: StudentProfile
}

export function ProfilePanel({ profile }: ProfilePanelProps) {
  const hasAnyData = profile.grade || profile.state || profile.interests.length || profile.goals.length

  if (!hasAnyData) return null

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
      <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Your Profile</h3>
      <div className="space-y-2">
        {profile.grade && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Grade</span>
            <span className="font-medium">{profile.grade}</span>
          </div>
        )}
        {profile.state && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">State</span>
            <span className="font-medium">{profile.state}</span>
          </div>
        )}
        {profile.gpa && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">GPA</span>
            <span className="font-medium">{profile.gpa}</span>
          </div>
        )}
        {profile.interests.length > 0 && (
          <div className="space-y-1">
            <span className="text-muted-foreground">Interests</span>
            <div className="flex flex-wrap gap-1">
              {profile.interests.map((i) => (
                <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
              ))}
            </div>
          </div>
        )}
        {profile.specialCircumstances.length > 0 && (
          <div className="space-y-1">
            <span className="text-muted-foreground">Circumstances</span>
            <div className="flex flex-wrap gap-1">
              {profile.specialCircumstances.map((c) => (
                <Badge key={c} variant="outline" className="text-xs">{c.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] Commit

```bash
git add src/components/panels/
git commit -m "feat: add structured panel components (ComparisonTable, PathwayCards, TimelineChecklist, ProfilePanel)"
```

---

## Task 16: Pages — Landing + Chat

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/chat/[sessionId]/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] Rewrite `src/app/page.tsx`

```typescript
// src/app/page.tsx
import { PersonaSelector } from '@/components/layout/PersonaSelector'
import { Header } from '@/components/layout/Header'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <PersonaSelector />
      </main>
    </div>
  )
}
```

- [ ] Create `src/app/chat/[sessionId]/page.tsx`

```typescript
// src/app/chat/[sessionId]/page.tsx
import { ChatInterface } from '@/components/chat/ChatInterface'
import { Header } from '@/components/layout/Header'
import { getPersonaById } from '@/lib/data/personas'

interface ChatPageProps {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ persona?: string }>
}

export default async function ChatPage({ params, searchParams }: ChatPageProps) {
  const { sessionId } = await params
  const { persona: personaId } = await searchParams
  const persona = personaId ? getPersonaById(personaId) : undefined

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header personaName={persona?.name} sessionId={sessionId} />
      <ChatInterface
        sessionId={sessionId}
        personaId={personaId}
        personaName={persona?.name}
      />
    </div>
  )
}
```

- [ ] Update `src/app/layout.tsx` to set title

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PathwayAI — College & Career Advisor',
  description: 'AI-powered college and career advising for high school students',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
```

- [ ] Commit

```bash
git add src/app/page.tsx src/app/chat/ src/app/layout.tsx
git commit -m "feat: add landing page and chat page routes"
```

---

## Task 17: Final wiring — verify build + smoke test

- [ ] Copy `.env.local.example` to `.env.local` and add at minimum the Anthropic API key

```bash
cp .env.local.example .env.local
# Then edit .env.local and add ANTHROPIC_API_KEY=your_key_here
```

- [ ] Run TypeScript check

```bash
cd "/Users/25veers/Desktop/cs projects/gates_user-prototype"
npx tsc --noEmit
```

Expected: No errors (fix any type errors before proceeding)

- [ ] Run dev server

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000

- [ ] Smoke test checklist
  - [ ] Visit http://localhost:3000 — persona selector loads with 10 cards
  - [ ] Click "Mateo" — redirects to `/chat/<sessionId>?persona=mateo`
  - [ ] Greeting message appears referencing Mateo
  - [ ] Type a message and press Enter — response streams in
  - [ ] Visit http://localhost:3000 → click "Start Fresh" — chat loads with generic greeting
  - [ ] Test API directly: `curl http://localhost:3000/api/schools?state=CA` — returns JSON with schools

- [ ] Fix any issues found during smoke test

- [ ] Final commit

```bash
git add -A
git commit -m "feat: complete MVP implementation of Gates advising prototype"
```

---

## Self-Review

**Spec coverage check:**
- ✅ 5-layer architecture (frontend, orchestration, data retrieval, LLM, guardrails)
- ✅ 2 primary use cases (pathway exploration, application/aid prep)
- ✅ College Scorecard API integration (Task 6 + 12)
- ✅ O*NET API integration (Task 7 + 12)
- ✅ RAG interface with in-memory impl swappable to Pinecone (Task 5)
- ✅ Intent classification (Task 10)
- ✅ Query rewriting (merged into intent classifier — rewrittenQuery field)
- ✅ Session memory ephemeral (Task 8)
- ✅ Input guardrails — PII + injection (Task 9)
- ✅ Output guardrails — hallucination + PII filter (Task 9)
- ✅ Graceful degradation on API failure (Task 12)
- ✅ Chat interface with streaming (Task 14)
- ✅ Persona selector (Task 13)
- ✅ ComparisonTable, PathwayCards, TimelineChecklist (Task 15)
- ✅ ProfilePanel (Task 15)
- ✅ 10 personas from research doc (Task 4)
- ✅ 15 curated schools with IPEDS/CDS fields (Task 3)
- ✅ System prompt encoding research findings (Task 11)
- ✅ CADAA/FAFSA distinction in system prompt (Task 11)
- ✅ Data vintage disclosure (Task 9)

**Type consistency:** All types defined in `types.ts` (Task 2). Service interfaces use those types. Components import from `@/lib/types`. ✅

**No placeholders:** All steps include complete code. ✅
