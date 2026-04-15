# RAG Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory `InMemoryRAGService` with a Pinecone vector store backed by IPEDS bulk CSV data and curated CDS JSON, using OpenAI `text-embedding-3-small` embeddings.

**Architecture:** Standalone TypeScript ingest scripts (`tsx`) process IPEDS CSVs and CDS JSON, converting each institution to a natural-language text chunk, embedding via OpenAI, and upserting to Pinecone. `PineconeRAGService` replaces `InMemoryRAGService` at query time — same `IRAGService` interface, no changes needed in `route.ts` or `prompt-builder.ts`. Falls back to `InMemoryRAGService` when `PINECONE_API_KEY` is absent.

**Tech Stack:** Pinecone serverless (us-east-1, cosine, 1536-dim), OpenAI text-embedding-3-small, papaparse (CSV), tsx (script runner), vitest (unit tests), adm-zip (ZIP extraction)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add new dependencies |
| `.env.local.example` | Modify | Document new env vars |
| `.gitignore` | Modify | Ignore `data/ipeds/` raw CSV files |
| `vitest.config.ts` | Create | Test runner config with `@/` alias |
| `src/lib/utils/chunk-formatters.ts` | Create | Pure functions: IPEDS/CDS record → text chunk + Pinecone metadata |
| `src/lib/services/embeddings.ts` | Create | Shared OpenAI embedding helper (batched) |
| `src/lib/data/cds.ts` | Create | Curated CDS data for 23 schools |
| `src/lib/services/rag.ts` | Modify | Add `PineconeRAGService`, update `ragService` export |
| `scripts/download-ipeds.ts` | Create | Download + unzip IPEDS CSVs from NCES into `data/ipeds/` |
| `scripts/ingest-ipeds.ts` | Create | `data/ipeds/` CSVs → Pinecone |
| `scripts/ingest-cds.ts` | Create | `src/lib/data/cds.ts` → Pinecone |
| `tests/utils/chunk-formatters.test.ts` | Create | Unit tests for chunk formatter pure functions |

---

## Task 1: Install Dependencies + Environment Variables

**Files:**
- Modify: `package.json`
- Modify: `.env.local.example`
- Modify: `.gitignore`

- [ ] **Step 1: Install new packages**

```bash
cd "/Users/25veers/Desktop/cs projects/gates_user-prototype"
pnpm add @pinecone-database/pinecone openai papaparse
pnpm add -D @types/papaparse tsx vitest adm-zip @types/adm-zip
```

Expected: packages install without errors.

- [ ] **Step 2: Add env vars to `.env.local.example`**

Replace the full file content:

```
ANTHROPIC_API_KEY=your_anthropic_key_here
COLLEGE_SCORECARD_API_KEY=your_scorecard_key_here
ONET_USERNAME=your_onet_username_here
ONET_PASSWORD=your_onet_password_here
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=pathwayai-schools
OPENAI_API_KEY=your_openai_api_key_here
```

- [ ] **Step 3: Add raw data dir to `.gitignore`**

Open `.gitignore` (or create it if it doesn't exist) and append:

```
# IPEDS raw CSV downloads — large files, do not commit
data/
```

- [ ] **Step 4: Add test + ingest scripts to `package.json`**

In the `"scripts"` section, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"ingest:ipeds": "tsx scripts/ingest-ipeds.ts",
"ingest:cds": "tsx scripts/ingest-cds.ts",
"download:ipeds": "tsx scripts/download-ipeds.ts"
```

- [ ] **Step 5: Commit**

```bash
git add package.json .env.local.example .gitignore
git commit -m "feat: add RAG pipeline dependencies and env vars"
```

---

## Task 2: Vitest Config + Failing Chunk Formatter Tests

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/utils/chunk-formatters.test.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Create `tests/utils/chunk-formatters.test.ts` with failing tests**

```ts
import { describe, it, expect } from 'vitest'
import {
  formatIpedsChunk,
  formatCdsChunk,
  buildIpedsMetadata,
  buildCdsMetadata,
  type IpedsRecord,
  type CDSEntry,
} from '@/lib/utils/chunk-formatters'

const sampleIpeds: IpedsRecord = {
  unitId: '113364',
  name: 'City College of San Francisco',
  city: 'San Francisco',
  state: 'CA',
  type: 'community_college',
  inStateTuition: 1288,
  outOfStateTuition: 9528,
  gradRate: 0.17,
  requiresTestScore: false,
  satRangeLow: null,
  satRangeHigh: null,
  cipCodes: ['51.38', '52.02'],
  dataYear: 2023,
}

const sampleCds: CDSEntry = {
  unitId: '113364',
  name: 'City College of San Francisco',
  city: 'San Francisco',
  state: 'CA',
  type: 'community_college',
  regularDecisionDeadline: '2026-07-15',
  earlyDecisionDeadline: null,
  earlyActionDeadline: null,
  requiresTestScore: false,
  requiresLettersOfRec: false,
  requiresEssay: false,
  aidTypes: ['grants', 'work-study', 'loans'],
  avgAidPackage: 6800,
  pctReceivingAid: 0.72,
  medianGPA: null,
  satMidpoint: null,
  specialNotes: ['CADAA eligible', 'AB 540 eligible'],
  dataYear: 2024,
}

describe('formatIpedsChunk', () => {
  it('includes institution name and state', () => {
    const chunk = formatIpedsChunk(sampleIpeds)
    expect(chunk).toContain('City College of San Francisco')
    expect(chunk).toContain('San Francisco, CA')
  })

  it('includes tuition', () => {
    const chunk = formatIpedsChunk(sampleIpeds)
    expect(chunk).toContain('$1,288')
  })

  it('includes grad rate as percentage', () => {
    const chunk = formatIpedsChunk(sampleIpeds)
    expect(chunk).toContain('17%')
  })

  it('says "not required" when test scores not required', () => {
    const chunk = formatIpedsChunk(sampleIpeds)
    expect(chunk).toContain('not required')
  })

  it('includes data year', () => {
    const chunk = formatIpedsChunk(sampleIpeds)
    expect(chunk).toContain('2023')
  })
})

describe('formatCdsChunk', () => {
  it('includes institution name', () => {
    const chunk = formatCdsChunk(sampleCds)
    expect(chunk).toContain('City College of San Francisco')
  })

  it('includes application deadline', () => {
    const chunk = formatCdsChunk(sampleCds)
    expect(chunk).toContain('July 15, 2026')
  })

  it('includes aid package', () => {
    const chunk = formatCdsChunk(sampleCds)
    expect(chunk).toContain('$6,800')
  })

  it('includes special notes', () => {
    const chunk = formatCdsChunk(sampleCds)
    expect(chunk).toContain('CADAA eligible')
  })
})

describe('buildIpedsMetadata', () => {
  it('returns correct state and type', () => {
    const meta = buildIpedsMetadata(sampleIpeds)
    expect(meta.state).toBe('CA')
    expect(meta.type).toBe('community_college')
    expect(meta.dataSource).toBe('ipeds')
  })

  it('includes unitId', () => {
    const meta = buildIpedsMetadata(sampleIpeds)
    expect(meta.unitId).toBe('113364')
  })
})

describe('buildCdsMetadata', () => {
  it('marks dataSource as cds', () => {
    const meta = buildCdsMetadata(sampleCds)
    expect(meta.dataSource).toBe('cds')
  })

  it('includes unitId', () => {
    const meta = buildCdsMetadata(sampleCds)
    expect(meta.unitId).toBe('113364')
  })
})
```

- [ ] **Step 3: Run tests — confirm they fail**

```bash
pnpm test
```

Expected: `Error: Cannot find module '@/lib/utils/chunk-formatters'`

- [ ] **Step 4: Commit failing tests**

```bash
git add vitest.config.ts tests/
git commit -m "test: add failing chunk formatter tests"
```

---

## Task 3: Implement Chunk Formatters (Make Tests Pass)

**Files:**
- Create: `src/lib/utils/chunk-formatters.ts`

- [ ] **Step 1: Create `src/lib/utils/chunk-formatters.ts`**

```ts
import type { SchoolType } from '@/lib/types'

export interface IpedsRecord {
  unitId: string
  name: string
  city: string
  state: string
  type: SchoolType
  inStateTuition: number
  outOfStateTuition: number
  gradRate: number
  requiresTestScore: boolean
  satRangeLow: number | null
  satRangeHigh: number | null
  cipCodes: string[]
  dataYear: number
}

export interface CDSEntry {
  unitId: string
  name: string
  city: string
  state: string
  type: SchoolType
  regularDecisionDeadline: string | null
  earlyDecisionDeadline: string | null
  earlyActionDeadline: string | null
  requiresTestScore: boolean
  requiresLettersOfRec: boolean
  requiresEssay: boolean
  aidTypes: string[]
  avgAidPackage: number | null
  pctReceivingAid: number | null
  medianGPA: number | null
  satMidpoint: number | null
  specialNotes: string[]
  dataYear: number
}

export interface PineconeMetadata {
  unitId: string
  name: string
  state: string
  type: string
  city: string
  dataSource: 'ipeds' | 'cds'
  dataYear: number
  cipCodes?: string[]
  [key: string]: string | number | boolean | string[] | undefined
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}

function formatPercent(n: number): string {
  return `${Math.round(n * 100)}%`
}

function formatDeadline(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function humanType(type: SchoolType): string {
  const map: Record<SchoolType, string> = {
    community_college: 'community college',
    '4_year_public': 'public four-year university',
    '4_year_private': 'private four-year university',
    tribal: 'tribal college',
    arts: 'arts college',
  }
  return map[type]
}

export function formatIpedsChunk(r: IpedsRecord): string {
  const parts: string[] = []
  parts.push(`${r.name} is a ${humanType(r.type)} in ${r.city}, ${r.state}.`)
  parts.push(`In-state tuition: ${formatCurrency(r.inStateTuition)}/year.`)
  parts.push(`Out-of-state tuition: ${formatCurrency(r.outOfStateTuition)}/year.`)
  parts.push(`Graduation rate: ${formatPercent(r.gradRate)}.`)
  if (r.requiresTestScore) {
    if (r.satRangeLow && r.satRangeHigh) {
      parts.push(`Test scores required. SAT range: ${r.satRangeLow}–${r.satRangeHigh}.`)
    } else {
      parts.push(`Test scores required.`)
    }
  } else {
    parts.push(`Test scores not required.`)
  }
  if (r.cipCodes.length > 0) {
    parts.push(`Programs offered in CIP areas: ${r.cipCodes.join(', ')}.`)
  }
  parts.push(`Data year: ${r.dataYear}.`)
  return parts.join(' ')
}

export function formatCdsChunk(e: CDSEntry): string {
  const parts: string[] = []
  parts.push(`${e.name} is a ${humanType(e.type)} in ${e.city}, ${e.state}.`)
  if (e.regularDecisionDeadline) {
    parts.push(`Regular decision deadline: ${formatDeadline(e.regularDecisionDeadline)}.`)
  }
  if (e.earlyDecisionDeadline) {
    parts.push(`Early decision deadline: ${formatDeadline(e.earlyDecisionDeadline)}.`)
  }
  if (e.earlyActionDeadline) {
    parts.push(`Early action deadline: ${formatDeadline(e.earlyActionDeadline)}.`)
  }
  parts.push(`Test scores: ${e.requiresTestScore ? 'required' : 'not required'}.`)
  parts.push(`Letters of recommendation: ${e.requiresLettersOfRec ? 'required' : 'not required'}.`)
  parts.push(`Essay: ${e.requiresEssay ? 'required' : 'not required'}.`)
  if (e.avgAidPackage !== null) {
    parts.push(`Average financial aid package: ${formatCurrency(e.avgAidPackage)}.`)
  }
  if (e.pctReceivingAid !== null) {
    parts.push(`${formatPercent(e.pctReceivingAid)} of students receive financial aid.`)
  }
  if (e.aidTypes.length > 0) {
    parts.push(`Aid types available: ${e.aidTypes.join(', ')}.`)
  }
  if (e.medianGPA !== null) {
    parts.push(`Median admitted GPA: ${e.medianGPA.toFixed(2)}.`)
  }
  if (e.satMidpoint !== null) {
    parts.push(`SAT midpoint: ${e.satMidpoint}.`)
  }
  if (e.specialNotes.length > 0) {
    parts.push(`Notes: ${e.specialNotes.join(' ')}.`)
  }
  parts.push(`Data year: ${e.dataYear}.`)
  return parts.join(' ')
}

export function buildIpedsMetadata(r: IpedsRecord): PineconeMetadata {
  return {
    unitId: r.unitId,
    name: r.name,
    state: r.state,
    type: r.type,
    city: r.city,
    dataSource: 'ipeds',
    dataYear: r.dataYear,
    cipCodes: r.cipCodes,
    inStateTuition: r.inStateTuition,
    outOfStateTuition: r.outOfStateTuition,
    gradRate: r.gradRate,
    requiresTestScore: r.requiresTestScore,
    satRangeLow: r.satRangeLow ?? -1,
    satRangeHigh: r.satRangeHigh ?? -1,
  }
}

export function buildCdsMetadata(e: CDSEntry): PineconeMetadata {
  return {
    unitId: e.unitId,
    name: e.name,
    state: e.state,
    type: e.type,
    city: e.city,
    dataSource: 'cds',
    dataYear: e.dataYear,
    regularDecisionDeadline: e.regularDecisionDeadline ?? '',
    earlyDecisionDeadline: e.earlyDecisionDeadline ?? '',
    earlyActionDeadline: e.earlyActionDeadline ?? '',
    requiresTestScore: e.requiresTestScore,
    requiresLettersOfRec: e.requiresLettersOfRec,
    requiresEssay: e.requiresEssay,
    avgAidPackage: e.avgAidPackage ?? -1,
    pctReceivingAid: e.pctReceivingAid ?? -1,
    medianGPA: e.medianGPA ?? -1,
    satMidpoint: e.satMidpoint ?? -1,
    aidTypes: e.aidTypes,
    specialNotes: e.specialNotes,
  }
}
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
pnpm test
```

Expected: all 10 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/chunk-formatters.ts
git commit -m "feat: add chunk formatter utilities for IPEDS and CDS records"
```

---

## Task 4: Embedding Service

**Files:**
- Create: `src/lib/services/embeddings.ts`

- [ ] **Step 1: Create `src/lib/services/embeddings.ts`**

```ts
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 100

/**
 * Embed a single text string.
 */
export async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({ model: MODEL, input: text })
  return res.data[0].embedding
}

/**
 * Embed an array of texts in batches of BATCH_SIZE.
 * Returns embeddings in the same order as input texts.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const res = await openai.embeddings.create({ model: MODEL, input: batch })
    // OpenAI returns results sorted by index
    const sorted = res.data.sort((a, b) => a.index - b.index)
    results.push(...sorted.map((r) => r.embedding))
    console.log(`  Embedded ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length}`)
  }
  return results
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsx --noEmit src/lib/services/embeddings.ts 2>/dev/null || npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/embeddings.ts
git commit -m "feat: add OpenAI embedding service"
```

---

## Task 5: CDS Data File

**Files:**
- Create: `src/lib/data/cds.ts`

- [ ] **Step 1: Create `src/lib/data/cds.ts`**

```ts
import type { CDSEntry } from '@/lib/utils/chunk-formatters'

export const CDS_DATA: CDSEntry[] = [
  // ── California ──────────────────────────────────────────────
  {
    unitId: '113364',
    name: 'City College of San Francisco',
    city: 'San Francisco',
    state: 'CA',
    type: 'community_college',
    regularDecisionDeadline: '2026-07-15',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'work-study', 'loans', 'CADAA'],
    avgAidPackage: 6800,
    pctReceivingAid: 0.72,
    medianGPA: null,
    satMidpoint: null,
    specialNotes: [
      'California Dream Act (CADAA) financial aid available for AB 540 eligible students',
      'Open enrollment — no academic admission requirements',
      'Strong ADN nursing program with competitive waitlist',
    ],
    dataYear: 2024,
  },
  {
    unitId: '110592',
    name: 'East Los Angeles College',
    city: 'Monterey Park',
    state: 'CA',
    type: 'community_college',
    regularDecisionDeadline: '2026-07-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'work-study', 'loans', 'CADAA'],
    avgAidPackage: 7100,
    pctReceivingAid: 0.78,
    medianGPA: null,
    satMidpoint: null,
    specialNotes: [
      'CADAA and AB 540 eligible',
      'Large first-generation student support programs',
      'Transfer articulation agreements with UC and CSU systems',
      'One of the largest Hispanic-Serving Institutions in the country',
    ],
    dataYear: 2024,
  },
  {
    unitId: '112155',
    name: 'De Anza College',
    city: 'Cupertino',
    state: 'CA',
    type: 'community_college',
    regularDecisionDeadline: '2026-06-30',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'work-study', 'loans', 'CADAA'],
    avgAidPackage: 7200,
    pctReceivingAid: 0.65,
    medianGPA: null,
    satMidpoint: null,
    specialNotes: [
      'High transfer rate to UC schools, especially UC Santa Cruz and UC Davis',
      'Strong STEM and computer science programs',
      'CADAA eligible for undocumented students',
    ],
    dataYear: 2024,
  },
  {
    unitId: '122796',
    name: 'Santa Monica College',
    city: 'Santa Monica',
    state: 'CA',
    type: 'community_college',
    regularDecisionDeadline: '2026-07-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'work-study', 'loans', 'CADAA'],
    avgAidPackage: 6900,
    pctReceivingAid: 0.69,
    medianGPA: null,
    satMidpoint: null,
    specialNotes: [
      '#1 transfer college to UCLA in California',
      'CADAA eligible',
      'Strong arts, film, and media programs',
      'Honors Transfer Program with guaranteed UCLA admission path',
    ],
    dataYear: 2024,
  },
  {
    unitId: '110662',
    name: 'University of California, Los Angeles',
    city: 'Los Angeles',
    state: 'CA',
    type: '4_year_public',
    regularDecisionDeadline: '2025-11-30',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: true,
    aidTypes: ['grants', 'loans', 'work-study', 'merit', 'need-based', 'CADAA'],
    avgAidPackage: 24000,
    pctReceivingAid: 0.55,
    medianGPA: 4.15,
    satMidpoint: 1405,
    specialNotes: [
      'UC Application used — deadline November 30 for fall admission',
      'CADAA available for AB 540 eligible students instead of FAFSA',
      'Regents Scholarship available for top applicants',
      'Transfer admission: TAG program available from California CCs',
    ],
    dataYear: 2024,
  },
  {
    unitId: '110635',
    name: 'University of California, Berkeley',
    city: 'Berkeley',
    state: 'CA',
    type: '4_year_public',
    regularDecisionDeadline: '2025-11-30',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: true,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based', 'CADAA'],
    avgAidPackage: 26000,
    pctReceivingAid: 0.58,
    medianGPA: 4.15,
    satMidpoint: 1415,
    specialNotes: [
      'UC Application deadline November 30',
      'CADAA available for AB 540 / undocumented students',
      'Blue and Gold Opportunity Plan: no tuition for families under $80,000/year',
    ],
    dataYear: 2024,
  },
  {
    unitId: '110680',
    name: 'University of California, San Diego',
    city: 'La Jolla',
    state: 'CA',
    type: '4_year_public',
    regularDecisionDeadline: '2025-11-30',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: true,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based', 'CADAA'],
    avgAidPackage: 22000,
    pctReceivingAid: 0.53,
    medianGPA: 4.1,
    satMidpoint: 1390,
    specialNotes: [
      'UC Application deadline November 30',
      'Strong nursing, health sciences, and engineering programs',
      'CADAA available for undocumented students',
    ],
    dataYear: 2024,
  },
  {
    unitId: '110622',
    name: 'California State University, Los Angeles',
    city: 'Los Angeles',
    state: 'CA',
    type: '4_year_public',
    regularDecisionDeadline: '2025-12-15',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based', 'CADAA', 'Cal Grant'],
    avgAidPackage: 13000,
    pctReceivingAid: 0.75,
    medianGPA: 3.2,
    satMidpoint: null,
    specialNotes: [
      'CADAA available for AB 540 eligible students',
      'Majority first-generation student body',
      'Strong nursing, social work, and business programs',
      'Impacted programs (nursing, business) require separate supplemental application',
    ],
    dataYear: 2024,
  },
  // ── Virginia ─────────────────────────────────────────────────
  {
    unitId: '234076',
    name: 'University of Virginia',
    city: 'Charlottesville',
    state: 'VA',
    type: '4_year_public',
    regularDecisionDeadline: '2026-01-01',
    earlyDecisionDeadline: '2025-11-01',
    earlyActionDeadline: null,
    requiresTestScore: true,
    requiresLettersOfRec: true,
    requiresEssay: true,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based', 'merit'],
    avgAidPackage: 28000,
    pctReceivingAid: 0.38,
    medianGPA: 4.2,
    satMidpoint: 1430,
    specialNotes: [
      'AccessUVA program: meets 100% of demonstrated financial need',
      'No loans for families earning under $80,000/year',
      'In-state tuition significantly lower than out-of-state',
    ],
    dataYear: 2024,
  },
  {
    unitId: '233921',
    name: 'Virginia Tech',
    city: 'Blacksburg',
    state: 'VA',
    type: '4_year_public',
    regularDecisionDeadline: '2026-01-15',
    earlyDecisionDeadline: '2025-11-01',
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: true,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based', 'merit'],
    avgAidPackage: 18000,
    pctReceivingAid: 0.42,
    medianGPA: 3.9,
    satMidpoint: 1310,
    specialNotes: [
      'Strong engineering, nursing, and agriculture programs',
      'ROTC programs available (Army, Navy, Air Force)',
      'In-state tuition preference for Virginia residents',
    ],
    dataYear: 2024,
  },
  {
    unitId: '232186',
    name: 'George Mason University',
    city: 'Fairfax',
    state: 'VA',
    type: '4_year_public',
    regularDecisionDeadline: '2026-02-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: '2025-11-01',
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: true,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based', 'merit'],
    avgAidPackage: 16000,
    pctReceivingAid: 0.48,
    medianGPA: 3.7,
    satMidpoint: 1230,
    specialNotes: [
      'One of the most diverse universities in Virginia',
      'Strong nursing, health sciences, and IT programs',
      'Close to federal job market in DC metro area',
    ],
    dataYear: 2024,
  },
  {
    unitId: '232982',
    name: 'Northern Virginia Community College',
    city: 'Annandale',
    state: 'VA',
    type: 'community_college',
    regularDecisionDeadline: '2026-08-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based'],
    avgAidPackage: 6200,
    pctReceivingAid: 0.58,
    medianGPA: null,
    satMidpoint: null,
    specialNotes: [
      'Largest community college in Virginia',
      'Guaranteed transfer agreements with all Virginia public universities',
      'Open enrollment — no academic requirements',
      'Strong nursing ADN program',
    ],
    dataYear: 2024,
  },
  // ── Texas ────────────────────────────────────────────────────
  {
    unitId: '228778',
    name: 'University of Texas at Austin',
    city: 'Austin',
    state: 'TX',
    type: '4_year_public',
    regularDecisionDeadline: '2025-12-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: true,
    requiresLettersOfRec: false,
    requiresEssay: true,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based', 'merit'],
    avgAidPackage: 19000,
    pctReceivingAid: 0.47,
    medianGPA: 3.9,
    satMidpoint: 1330,
    specialNotes: [
      'Top 10% Rule: Texas high school students in top 10% of class get automatic admission',
      'Longhorn Scholars program for first-generation and low-income students',
      'Strong nursing, business, and engineering programs',
    ],
    dataYear: 2024,
  },
  {
    unitId: '228723',
    name: 'Texas A&M University',
    city: 'College Station',
    state: 'TX',
    type: '4_year_public',
    regularDecisionDeadline: '2026-01-15',
    earlyDecisionDeadline: null,
    earlyActionDeadline: '2025-10-15',
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: true,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based', 'merit'],
    avgAidPackage: 17000,
    pctReceivingAid: 0.52,
    medianGPA: 3.8,
    satMidpoint: 1285,
    specialNotes: [
      'Top 10% Rule applies for Texas residents',
      'ROTC and Corps of Cadets — strong military pathway',
      'Need-based aid: Aggie Assurance covers tuition for families under $60,000/year',
    ],
    dataYear: 2024,
  },
  {
    unitId: '224922',
    name: 'Houston Community College',
    city: 'Houston',
    state: 'TX',
    type: 'community_college',
    regularDecisionDeadline: '2026-08-15',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based'],
    avgAidPackage: 5800,
    pctReceivingAid: 0.62,
    medianGPA: null,
    satMidpoint: null,
    specialNotes: [
      'Open enrollment community college',
      'Strong healthcare and nursing programs',
      'Texas Success Initiative (TSI) assessment may be required',
      'Articulation agreements with University of Houston and other Texas universities',
    ],
    dataYear: 2024,
  },
  // ── Illinois ─────────────────────────────────────────────────
  {
    unitId: '145637',
    name: 'University of Illinois Urbana-Champaign',
    city: 'Champaign',
    state: 'IL',
    type: '4_year_public',
    regularDecisionDeadline: '2026-01-05',
    earlyDecisionDeadline: null,
    earlyActionDeadline: '2025-11-01',
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: true,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based', 'merit'],
    avgAidPackage: 20000,
    pctReceivingAid: 0.5,
    medianGPA: 3.9,
    satMidpoint: 1390,
    specialNotes: [
      'Illinois Promise: free tuition for students from families earning under $67,100/year',
      'Strong engineering, CS, and nursing programs',
      'Minority Student Achievement program for first-gen students',
    ],
    dataYear: 2024,
  },
  {
    unitId: '144740',
    name: 'Wilbur Wright College (City Colleges of Chicago)',
    city: 'Chicago',
    state: 'IL',
    type: 'community_college',
    regularDecisionDeadline: '2026-08-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based'],
    avgAidPackage: 6100,
    pctReceivingAid: 0.7,
    medianGPA: null,
    satMidpoint: null,
    specialNotes: [
      'Open enrollment — no academic requirements',
      'City Colleges Promise: free tuition for Chicago high school graduates',
      'Articulation agreements with University of Illinois Chicago and other Illinois universities',
    ],
    dataYear: 2024,
  },
  // ── New Mexico ───────────────────────────────────────────────
  {
    unitId: '187985',
    name: 'University of New Mexico',
    city: 'Albuquerque',
    state: 'NM',
    type: '4_year_public',
    regularDecisionDeadline: '2026-03-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based', 'tribal'],
    avgAidPackage: 14000,
    pctReceivingAid: 0.65,
    medianGPA: 3.4,
    satMidpoint: 1100,
    specialNotes: [
      'New Mexico Opportunity Scholarship: free tuition for in-state students',
      'Native American Studies program and Native American Student Services office',
      'Indian Health Service scholarship recipients eligible for nursing program',
      'ADN-to-BSN nursing bridge programs available',
    ],
    dataYear: 2024,
  },
  {
    unitId: '187897',
    name: 'Diné College',
    city: 'Tsaile',
    state: 'NM',
    type: 'tribal',
    regularDecisionDeadline: '2026-07-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'tribal', 'BIE grant', 'IHS scholarship', 'Navajo Nation scholarship'],
    avgAidPackage: 8200,
    pctReceivingAid: 0.88,
    specialNotes: [
      'Tribal college — Bureau of Indian Education (BIE) grant eligible',
      'Indian Health Service (IHS) scholarship for nursing and health pathways',
      'Navajo Nation Scholarship Program available',
      'Located on the Navajo Nation reservation — reduces relocation barriers',
      'ADN-to-BSN articulation pathway with University of New Mexico',
    ],
    medianGPA: null,
    satMidpoint: null,
    dataYear: 2024,
  },
  {
    unitId: '386123',
    name: 'Navajo Technical University',
    city: 'Crownpoint',
    state: 'NM',
    type: 'tribal',
    regularDecisionDeadline: '2026-07-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'tribal', 'BIE grant', 'IHS scholarship', 'Navajo Nation scholarship'],
    avgAidPackage: 7900,
    pctReceivingAid: 0.86,
    medianGPA: null,
    satMidpoint: null,
    specialNotes: [
      'Tribal college on the Navajo Nation',
      'STEM-focused with nursing and health science programs',
      'Bureau of Indian Education (BIE) grant eligible',
      'IHS scholarship opportunities for health pathways',
    ],
    dataYear: 2024,
  },
  // ── New Jersey ───────────────────────────────────────────────
  {
    unitId: '186380',
    name: 'Rutgers University',
    city: 'New Brunswick',
    state: 'NJ',
    type: '4_year_public',
    regularDecisionDeadline: '2026-01-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: '2025-11-01',
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: true,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based', 'merit'],
    avgAidPackage: 21000,
    pctReceivingAid: 0.56,
    medianGPA: 3.9,
    satMidpoint: 1330,
    specialNotes: [
      'NJ Resident Tuition Aid Grant (TAG) available for NJ residents with financial need',
      'Garden State Guarantee: free tuition for NJ families earning under $65,000/year',
      'Large university with extensive support services for first-generation students',
      'Strong nursing and health sciences programs',
    ],
    dataYear: 2024,
  },
  {
    unitId: '184603',
    name: 'Bergen Community College',
    city: 'Paramus',
    state: 'NJ',
    type: 'community_college',
    regularDecisionDeadline: '2026-08-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'loans', 'work-study', 'need-based'],
    avgAidPackage: 6400,
    pctReceivingAid: 0.61,
    medianGPA: null,
    satMidpoint: null,
    specialNotes: [
      'Open enrollment',
      'NJ Tuition Aid Grant (TAG) available',
      'Transfer agreements with NJ four-year universities',
      'Strong nursing, allied health, and business programs',
    ],
    dataYear: 2024,
  },
  // ── Tribal (additional) ──────────────────────────────────────
  {
    unitId: '155061',
    name: 'Haskell Indian Nations University',
    city: 'Lawrence',
    state: 'KS',
    type: 'tribal',
    regularDecisionDeadline: '2026-07-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'tribal', 'BIE grant'],
    avgAidPackage: 9500,
    pctReceivingAid: 0.92,
    medianGPA: null,
    satMidpoint: null,
    specialNotes: [
      'Federally operated tribal university — free tuition for enrolled tribal members',
      'Bureau of Indian Education (BIE) funding',
      'Strong community for Native students from across the country',
      'Room and board assistance available',
    ],
    dataYear: 2024,
  },
  {
    unitId: '181446',
    name: 'Salish Kootenai College',
    city: 'Pablo',
    state: 'MT',
    type: 'tribal',
    regularDecisionDeadline: '2026-07-01',
    earlyDecisionDeadline: null,
    earlyActionDeadline: null,
    requiresTestScore: false,
    requiresLettersOfRec: false,
    requiresEssay: false,
    aidTypes: ['grants', 'tribal', 'BIE grant', 'IHS scholarship'],
    avgAidPackage: 8800,
    pctReceivingAid: 0.9,
    medianGPA: null,
    satMidpoint: null,
    specialNotes: [
      'Tribally controlled community college on the Flathead Reservation',
      'Strong nursing and health science programs',
      'IHS scholarship for health career pathways',
      'Bureau of Indian Education (BIE) grant eligible',
    ],
    dataYear: 2024,
  },
]
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/cds.ts
git commit -m "feat: add curated CDS data for 23 institutions"
```

---

## Task 6: IPEDS Download Script

**Files:**
- Create: `scripts/download-ipeds.ts`
- Create: `data/ipeds/.gitkeep`

- [ ] **Step 1: Create `data/ipeds/.gitkeep`**

```bash
mkdir -p "/Users/25veers/Desktop/cs projects/gates_user-prototype/data/ipeds"
touch "/Users/25veers/Desktop/cs projects/gates_user-prototype/data/ipeds/.gitkeep"
```

- [ ] **Step 2: Create `scripts/download-ipeds.ts`**

```ts
/**
 * Downloads IPEDS survey component CSV files from NCES and extracts them
 * into data/ipeds/. Run once before ingest-ipeds.ts.
 *
 * Usage: pnpm download:ipeds
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'

const YEAR = '2023'
const OUT_DIR = path.join(process.cwd(), 'data', 'ipeds')

const FILES = [
  { name: 'IC', url: `https://nces.ed.gov/ipeds/datacenter/data/IC${YEAR}.zip` },
  { name: 'ADM', url: `https://nces.ed.gov/ipeds/datacenter/data/ADM${YEAR}.zip` },
  { name: 'GR', url: `https://nces.ed.gov/ipeds/datacenter/data/GR${YEAR}.zip` },
]

async function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        download(res.headers.location!, dest).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
    }).on('error', reject)
  })
}

async function main() {
  console.log(`Downloading IPEDS ${YEAR} data to ${OUT_DIR}/\n`)

  for (const { name, url } of FILES) {
    const zipPath = path.join(OUT_DIR, `${name}${YEAR}.zip`)
    console.log(`Downloading ${name}${YEAR}.zip...`)
    await download(url, zipPath)

    console.log(`Extracting ${name}${YEAR}.zip...`)
    const zip = new AdmZip(zipPath)
    zip.extractAllTo(OUT_DIR, true)

    // Print extracted file names so user can verify CSV column names
    const entries = zip.getEntries().map((e) => e.entryName)
    console.log(`  Extracted: ${entries.join(', ')}`)
    fs.unlinkSync(zipPath)
    console.log(`  Done.\n`)
  }

  console.log('All IPEDS files downloaded.')
  console.log('\nIMPORTANT: Verify CSV column names match FIELD_NAMES in scripts/ingest-ipeds.ts')
  console.log('Run: head -1 data/ipeds/ic2023.csv | tr "," "\\n" | head -30')
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 3: Commit**

```bash
git add scripts/download-ipeds.ts data/ipeds/.gitkeep
git commit -m "feat: add IPEDS download script"
```

---

## Task 7: IPEDS Ingest Script

**Files:**
- Create: `scripts/ingest-ipeds.ts`

- [ ] **Step 1: Create `scripts/ingest-ipeds.ts`**

```ts
/**
 * Reads downloaded IPEDS CSV files, joins IC + ADM + GR on UNITID,
 * filters to public community colleges and 4-year publics + tribal colleges,
 * converts each to a natural-language text chunk, embeds via OpenAI,
 * and upserts to Pinecone.
 *
 * Usage: pnpm ingest:ipeds
 * Prerequisites: pnpm download:ipeds
 */

import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { Pinecone } from '@pinecone-database/pinecone'
import { embedBatch } from '../src/lib/services/embeddings'
import { formatIpedsChunk, buildIpedsMetadata, type IpedsRecord } from '../src/lib/utils/chunk-formatters'
import type { SchoolType } from '../src/lib/types'

// ── Field name configuration ─────────────────────────────────────────────────
// If NCES changes column names between years, update these constants.
// To inspect your CSV headers: head -1 data/ipeds/ic2023.csv | tr "," "\n"
const IC_FIELDS = {
  unitId: 'UNITID',
  name: 'INSTNM',
  city: 'CITY',
  state: 'STABBR',
  control: 'CONTROL',    // 1=public, 2=private nonprofit, 3=private for-profit
  level: 'ICLEVEL',     // 1=4-year, 2=2-year, 3=<2-year
  tuitionInState: 'TUITION2',
  tuitionOutState: 'TUITION3',
}

const ADM_FIELDS = {
  unitId: 'UNITID',
  testReq: 'ADMCON7',    // 1=required, 2=recommended, 3=neither required/recommended, 5=not considered
  satVrLow: 'SATVR25',
  satVrHigh: 'SATVR75',
  satMtLow: 'SATMT25',
  satMtHigh: 'SATMT75',
}

const GR_FIELDS = {
  unitId: 'UNITID',
  gradRate4yr: 'C150_4',   // 4-year schools: 150% time completion rate
  gradRate2yr: 'C150_L4',  // 2-year schools: 150% time completion rate
}

// ── Tribal college UNITID allowlist (AIHEC member institutions) ──────────────
const TRIBAL_UNIT_IDS = new Set([
  '155061', // Haskell Indian Nations University
  '181446', // Salish Kootenai College
  '187897', // Diné College
  '386123', // Navajo Technical University
  '219976', // Sitting Bull College
  '200004', // Turtle Mountain Community College
  '200800', // United Tribes Technical College
  '216278', // Oglala Lakota College
  '219471', // Sinte Gleska University
  '174792', // Fond du Lac Tribal and Community College
  '169044', // Bay Mills Community College
  '180489', // Chief Dull Knife College
  '180347', // Fort Peck Community College
  '180694', // Little Big Horn College
  '181604', // Stone Child College
  '200217', // Fort Berthold Community College
  '199677', // Cankdeska Cikana Community College
  '175752', // Keweenaw Bay Ojibwa Community College
  '238616', // Lac Courte Oreilles Ojibwa Community College
  '238476', // College of Menominee Nation
  '445027', // Tohono O'odham Community College
  '444004', // Ilisagvik College
  '180176', // Aaniiih Nakoda College
  '180228', // Blackfeet Community College
  '219940', // Sisseton Wahpeton College
])

const DATA_DIR = path.join(process.cwd(), 'data', 'ipeds')
const YEAR = '2023'
const PINECONE_BATCH = 100

function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const result = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  if (result.errors.length > 0) {
    console.warn(`  Parse warnings in ${path.basename(filePath)}:`, result.errors.slice(0, 3))
  }
  return result.data
}

function toNum(val: string | undefined): number {
  const n = parseFloat(val ?? '')
  return isNaN(n) ? 0 : n
}

function toNumOrNull(val: string | undefined): number | null {
  const n = parseFloat(val ?? '')
  return isNaN(n) ? null : n
}

async function main() {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  const index = pinecone.index(process.env.PINECONE_INDEX ?? 'pathwayai-schools').namespace('schools')

  // ── Load CSVs ──────────────────────────────────────────────────────────────
  console.log('Loading IPEDS CSV files...')
  const icFile = fs.readdirSync(DATA_DIR).find((f) => f.toLowerCase().startsWith('ic' + YEAR) && f.endsWith('.csv'))
  const admFile = fs.readdirSync(DATA_DIR).find((f) => f.toLowerCase().startsWith('adm' + YEAR) && f.endsWith('.csv'))
  const grFile = fs.readdirSync(DATA_DIR).find((f) => f.toLowerCase().startsWith('gr' + YEAR) && f.endsWith('.csv'))

  if (!icFile || !admFile || !grFile) {
    console.error('Missing CSV files. Run: pnpm download:ipeds')
    process.exit(1)
  }

  const icRows = parseCsv(path.join(DATA_DIR, icFile))
  const admRows = parseCsv(path.join(DATA_DIR, admFile))
  const grRows = parseCsv(path.join(DATA_DIR, grFile))

  console.log(`  IC: ${icRows.length} rows | ADM: ${admRows.length} rows | GR: ${grRows.length} rows`)

  // ── Build lookup maps ──────────────────────────────────────────────────────
  const admByUnitId = new Map(admRows.map((r) => [r[ADM_FIELDS.unitId], r]))
  const grByUnitId = new Map(grRows.map((r) => [r[GR_FIELDS.unitId], r]))

  // ── Filter and join ────────────────────────────────────────────────────────
  console.log('\nFiltering institutions...')
  const records: IpedsRecord[] = []

  for (const ic of icRows) {
    const unitId = ic[IC_FIELDS.unitId]
    const control = ic[IC_FIELDS.control]
    const level = ic[IC_FIELDS.level]
    const isPublic = control === '1'
    const is4Year = level === '1'
    const is2Year = level === '2'
    const isTribal = TRIBAL_UNIT_IDS.has(unitId)

    if (!isTribal && !(isPublic && (is4Year || is2Year))) continue

    const adm = admByUnitId.get(unitId)
    const gr = grByUnitId.get(unitId)

    const satLow = adm ? (toNumOrNull(adm[ADM_FIELDS.satVrLow]) ?? 0) + (toNumOrNull(adm[ADM_FIELDS.satMtLow]) ?? 0) : null
    const satHigh = adm ? (toNumOrNull(adm[ADM_FIELDS.satVrHigh]) ?? 0) + (toNumOrNull(adm[ADM_FIELDS.satMtHigh]) ?? 0) : null

    const gradRate4 = gr ? toNumOrNull(gr[GR_FIELDS.gradRate4yr]) : null
    const gradRate2 = gr ? toNumOrNull(gr[GR_FIELDS.gradRate2yr]) : null
    const gradRate = (gradRate4 ?? gradRate2 ?? 0) / 100

    let type: SchoolType = is2Year ? 'community_college' : '4_year_public'
    if (isTribal) type = 'tribal'

    records.push({
      unitId,
      name: ic[IC_FIELDS.name],
      city: ic[IC_FIELDS.city],
      state: ic[IC_FIELDS.state],
      type,
      inStateTuition: toNum(ic[IC_FIELDS.tuitionInState]),
      outOfStateTuition: toNum(ic[IC_FIELDS.tuitionOutState]),
      gradRate,
      requiresTestScore: adm ? adm[ADM_FIELDS.testReq] === '1' : false,
      satRangeLow: satLow && satLow > 0 ? satLow : null,
      satRangeHigh: satHigh && satHigh > 0 ? satHigh : null,
      cipCodes: [],
      dataYear: parseInt(YEAR),
    })
  }

  console.log(`  Kept ${records.length} institutions after filtering`)

  // ── Embed and upsert in batches ────────────────────────────────────────────
  console.log('\nEmbedding and upserting to Pinecone...')

  for (let i = 0; i < records.length; i += PINECONE_BATCH) {
    const batch = records.slice(i, i + PINECONE_BATCH)
    const texts = batch.map(formatIpedsChunk)
    const embeddings = await embedBatch(texts)

    const vectors = batch.map((record, j) => ({
      id: `ipeds_${record.unitId}`,
      values: embeddings[j],
      metadata: buildIpedsMetadata(record),
    }))

    await index.upsert(vectors)
    console.log(`  Upserted ${Math.min(i + PINECONE_BATCH, records.length)}/${records.length}`)
  }

  console.log(`\nDone. ${records.length} IPEDS institutions indexed in Pinecone.`)
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Verify it compiles (no API keys needed)**

```bash
npx tsc --noEmit
```

Expected: no type errors (may warn about unused vars — that's fine).

- [ ] **Step 3: Commit**

```bash
git add scripts/ingest-ipeds.ts
git commit -m "feat: add IPEDS ingest script"
```

---

## Task 8: CDS Ingest Script

**Files:**
- Create: `scripts/ingest-cds.ts`

- [ ] **Step 1: Create `scripts/ingest-cds.ts`**

```ts
/**
 * Reads curated CDS data from src/lib/data/cds.ts, converts each entry
 * to a natural-language text chunk, embeds via OpenAI, and upserts to Pinecone.
 *
 * Usage: pnpm ingest:cds
 */

import { Pinecone } from '@pinecone-database/pinecone'
import { CDS_DATA } from '../src/lib/data/cds'
import { embedBatch } from '../src/lib/services/embeddings'
import { formatCdsChunk, buildCdsMetadata } from '../src/lib/utils/chunk-formatters'

const PINECONE_BATCH = 100

async function main() {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  const index = pinecone.index(process.env.PINECONE_INDEX ?? 'pathwayai-schools').namespace('schools')

  console.log(`Ingesting ${CDS_DATA.length} CDS entries into Pinecone...\n`)

  for (let i = 0; i < CDS_DATA.length; i += PINECONE_BATCH) {
    const batch = CDS_DATA.slice(i, i + PINECONE_BATCH)
    const texts = batch.map(formatCdsChunk)
    const embeddings = await embedBatch(texts)

    const vectors = batch.map((entry, j) => ({
      id: `cds_${entry.unitId}`,
      values: embeddings[j],
      metadata: buildCdsMetadata(entry),
    }))

    await index.upsert(vectors)
    console.log(`  Upserted ${Math.min(i + PINECONE_BATCH, CDS_DATA.length)}/${CDS_DATA.length}`)
  }

  console.log(`\nDone. ${CDS_DATA.length} CDS entries indexed in Pinecone.`)
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/ingest-cds.ts
git commit -m "feat: add CDS ingest script"
```

---

## Task 9: PineconeRAGService + Update ragService Export

**Files:**
- Modify: `src/lib/services/rag.ts`

- [ ] **Step 1: Replace the full content of `src/lib/services/rag.ts`**

```ts
import { SCHOOLS, searchSchools } from '@/lib/data/schools'
import type { School, RAGQueryParams, RAGResult, SchoolType } from '@/lib/types'
import { embedText } from '@/lib/services/embeddings'

export interface IRAGService {
  query(params: RAGQueryParams): Promise<RAGResult[]>
  getByIds(unitIds: string[]): Promise<School[]>
}

// ── In-memory fallback ────────────────────────────────────────────────────────
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

// ── Pinecone implementation ───────────────────────────────────────────────────
export class PineconeRAGService implements IRAGService {
  private index: ReturnType<import('@pinecone-database/pinecone').Pinecone['index']>

  constructor() {
    const { Pinecone } = require('@pinecone-database/pinecone')
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
    this.index = pc
      .index(process.env.PINECONE_INDEX ?? 'pathwayai-schools')
      .namespace('schools')
  }

  async query(params: RAGQueryParams): Promise<RAGResult[]> {
    try {
      const queryText = params.query ?? [params.state, params.type?.join(' ')].filter(Boolean).join(' ')
      if (!queryText) return []

      const vector = await embedText(queryText)

      const filter: Record<string, unknown> = {}
      if (params.state) filter['state'] = { $eq: params.state }
      if (params.type && params.type.length === 1) filter['type'] = { $eq: params.type[0] }

      const res = await this.index.query({
        vector,
        topK: 5,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        includeMetadata: true,
      })

      return res.matches
        .filter((m) => m.metadata)
        .map((m) => ({
          school: metadataToSchool(m.metadata!),
          score: m.score ?? 0,
        }))
    } catch (err) {
      console.error('[PineconeRAGService] query failed, returning []:', err)
      return []
    }
  }

  async getByIds(unitIds: string[]): Promise<School[]> {
    try {
      const ids = unitIds.flatMap((id) => [`ipeds_${id}`, `cds_${id}`])
      const res = await this.index.fetch(ids)
      return Object.values(res.records)
        .filter((r) => r.metadata)
        .map((r) => metadataToSchool(r.metadata!))
    } catch (err) {
      console.error('[PineconeRAGService] getByIds failed, returning []:', err)
      return []
    }
  }
}

function metadataToSchool(meta: Record<string, unknown>): School {
  const satLow = meta['satRangeLow'] as number
  const satHigh = meta['satRangeHigh'] as number
  return {
    unitId: String(meta['unitId'] ?? ''),
    opeid: String(meta['opeid'] ?? ''),
    name: String(meta['name'] ?? ''),
    state: String(meta['state'] ?? ''),
    type: String(meta['type'] ?? 'community_college') as SchoolType,
    city: String(meta['city'] ?? ''),
    inStateTuition: Number(meta['inStateTuition'] ?? 0),
    outOfStateTuition: Number(meta['outOfStateTuition'] ?? 0),
    netPriceMedian: Number(meta['netPriceMedian'] ?? 0),
    gradRate: Number(meta['gradRate'] ?? 0),
    admissionRate: meta['admissionRate'] != null && Number(meta['admissionRate']) >= 0
      ? Number(meta['admissionRate']) : null,
    satRange: satLow > 0 && satHigh > 0 ? [satLow, satHigh] : null,
    programs: Array.isArray(meta['cipCodes']) ? (meta['cipCodes'] as string[]) : [],
    medianEarnings10yr: Number(meta['medianEarnings10yr'] ?? 0),
    medianLoanDebt: Number(meta['medianLoanDebt'] ?? 0),
    applicationDeadline: String(meta['regularDecisionDeadline'] ?? meta['applicationDeadline'] ?? ''),
    earlyDecisionDeadline: meta['earlyDecisionDeadline'] ? String(meta['earlyDecisionDeadline']) : null,
    requiresTestScore: Boolean(meta['requiresTestScore']),
    avgAidPackage: Number(meta['avgAidPackage'] ?? 0),
    pctReceivingAid: Number(meta['pctReceivingAid'] ?? 0),
    specialNotes: Array.isArray(meta['specialNotes']) ? (meta['specialNotes'] as string[]) : [],
    dataYear: Number(meta['dataYear'] ?? 2023),
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// Uses PineconeRAGService when PINECONE_API_KEY is set, falls back to in-memory.
export const ragService: IRAGService = process.env.PINECONE_API_KEY
  ? new PineconeRAGService()
  : new InMemoryRAGService()
```

- [ ] **Step 2: Run tests to confirm nothing broke**

```bash
pnpm test
```

Expected: all 10 tests still pass (they don't touch rag.ts).

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/rag.ts
git commit -m "feat: add PineconeRAGService and switch ragService to Pinecone when key is present"
```

---

## Task 10: End-to-End Verification

- [ ] **Step 1: Set up Pinecone index**

1. Go to [pinecone.io](https://pinecone.io) → sign up / log in
2. Create a new index:
   - Name: `pathwayai-schools`
   - Dimensions: `1536`
   - Metric: `cosine`
   - Serverless → AWS → us-east-1
3. Copy the API key from the Pinecone console

- [ ] **Step 2: Add keys to `.env.local`**

```
PINECONE_API_KEY=<your-key>
PINECONE_INDEX=pathwayai-schools
OPENAI_API_KEY=<your-openai-key>
```

- [ ] **Step 3: Download IPEDS data**

```bash
pnpm download:ipeds
```

Expected output:
```
Downloading IPEDS 2023 data to .../data/ipeds/

Downloading IC2023.zip...
Extracting IC2023.zip...
  Extracted: ic2023.csv, ic2023_rv.csv
  Done.

Downloading ADM2023.zip...
...
All IPEDS files downloaded.

IMPORTANT: Verify CSV column names match FIELD_NAMES in scripts/ingest-ipeds.ts
```

- [ ] **Step 4: Verify IPEDS column names match the script's constants**

```bash
head -1 data/ipeds/ic2023.csv | tr "," "\n" | grep -E "UNITID|INSTNM|CITY|STABBR|CONTROL|ICLEVEL|TUITION"
head -1 data/ipeds/adm2023.csv | tr "," "\n" | grep -E "UNITID|ADMCON|SAT"
head -1 data/ipeds/gr2023.csv | tr "," "\n" | grep -E "UNITID|C150"
```

If column names differ from `IC_FIELDS`, `ADM_FIELDS`, or `GR_FIELDS` in `scripts/ingest-ipeds.ts`, update the constants to match.

- [ ] **Step 5: Run IPEDS ingest**

```bash
pnpm ingest:ipeds
```

Expected: logs ~2,000–3,000 institutions filtered, progress bars for embedding and upsert batches, completion message.

- [ ] **Step 6: Run CDS ingest**

```bash
pnpm ingest:cds
```

Expected:
```
Ingesting 23 CDS entries into Pinecone...

  Embedded 23/23
  Upserted 23/23

Done. 23 CDS entries indexed in Pinecone.
```

- [ ] **Step 7: Start dev server and test a chat message**

```bash
pnpm dev
```

Open `http://localhost:3000`, select Mateo persona, send: "what community colleges in California have nursing programs?"

Expected: response references real schools from Pinecone (not just the 20 hardcoded ones). Check the terminal — you should see no `[PineconeRAGService] query failed` errors.

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "chore: verify RAG pipeline end-to-end"
```
