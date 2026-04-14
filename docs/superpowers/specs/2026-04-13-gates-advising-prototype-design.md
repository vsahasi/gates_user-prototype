# Gates College & Career Advising Prototype — Design Spec
**Date:** 2026-04-13
**Status:** Approved
**Delivery target:** May 8, 2026

---

## 1. Overview

An AI-powered college and career advising tool for high school students (grades 9–12), focused on first-generation, low-income, and nontraditional students underserved by existing advising systems. Built as a Next.js monorepo (frontend + API routes), integrating Claude API, College Scorecard, O*NET, and a curated static school dataset (IPEDS + CDS) serving as the RAG layer for MVP.

**Two primary use cases:**
1. **Pathway Exploration** — help students discover and compare postsecondary pathways (4-year, CC transfer, trade, apprenticeship, military, tribal college) using O*NET + College Scorecard + school RAG
2. **Application & Financial Aid Prep** — step-by-step action plans for applications, FAFSA/CADAA, deadlines, and checklist generation using school RAG (CDS data)

---

## 2. Architecture

### 2.1 Stack

| Layer | Technology |
|---|---|
| Frontend + API routes | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| LLM | Claude API (claude-sonnet-4-6) |
| Live data | College Scorecard REST API, O*NET Web Services REST API |
| Static RAG (MVP) | Curated JSON in-memory (swappable to Pinecone via interface) |
| Deployment | Vercel |

### 2.2 File Structure

```
src/
  app/
    page.tsx                      # Landing: persona selector or "start fresh"
    chat/[sessionId]/page.tsx     # Main chat interface (Client Component shell)
    api/
      chat/route.ts               # POST — streaming orchestration endpoint
      schools/route.ts            # GET — curated school lookup (RAG layer)
      scorecard/route.ts          # GET — College Scorecard API proxy
      onet/route.ts               # GET — O*NET API proxy
  components/
    chat/
      ChatInterface.tsx           # Full chat shell, manages message state
      MessageBubble.tsx           # Individual message with markdown rendering
      ChatInput.tsx               # Text input + send button
    panels/
      ProfilePanel.tsx            # Shows accumulated student profile (sidebar)
      ComparisonTable.tsx         # Side-by-side school/program comparison
      PathwayCards.tsx            # Recommended pathway cards with CTAs
      TimelineChecklist.tsx       # Week-by-week action plan with deadlines
    layout/
      Header.tsx                  # App header with persona indicator
      PersonaSelector.tsx         # Demo mode: 10 persona cards + "start fresh"
  lib/
    data/
      schools.ts                  # Curated school dataset (15 schools)
      personas.ts                 # 10 synthetic persona definitions
    services/
      scorecard.ts                # ICollegeScorecardService interface + impl
      onet.ts                     # IONETService interface + impl
      rag.ts                      # IRAGService interface + in-memory JSON impl
    orchestration/
      intent.ts                   # Intent classifier via Claude fast prompt
      query-rewriter.ts           # Query rewriting with session context
      prompt-builder.ts           # Assembles full prompt (system + context + history)
      guardrails.ts               # Input PII/injection + output hallucination/bias
      session.ts                  # In-memory session store (Map<sessionId, SessionState>)
    types.ts                      # Shared TypeScript types
```

### 2.3 Service Interfaces (abstraction for future swap)

```typescript
// rag.ts
interface IRAGService {
  query(params: RAGQueryParams): Promise<RAGResult[]>
}
// MVP: InMemoryRAGService implements IRAGService using schools.ts JSON
// Future: PineconeRAGService implements IRAGService using Pinecone SDK

// scorecard.ts
interface ICollegeScorecardService {
  searchPrograms(params: ScorecardQueryParams): Promise<ScorecardResult[]>
  getInstitution(unitId: string): Promise<ScorecardInstitution>
}

// onet.ts
interface IONETService {
  searchOccupations(keywords: string): Promise<ONETOccupation[]>
  getOccupationDetail(code: string): Promise<ONETOccupationDetail>
}
```

---

## 3. Data Layer

### 3.1 School Dataset (15 curated institutions)

Each school includes synthetic IPEDS + CDS fields derived from publicly available data patterns. Schema:

```typescript
interface School {
  unitId: string
  opeid: string
  name: string
  state: string
  type: "community_college" | "4_year_public" | "4_year_private" | "tribal" | "arts"
  city: string
  inStateTuition: number
  outOfStateTuition: number
  netPriceMedian: number         // after aid
  gradRate: number               // 0–1
  admissionRate: number | null   // null = open admission
  satRange: [number, number] | null
  programs: string[]             // CIP codes offered
  medianEarnings10yr: number
  medianLoanDebt: number
  // CDS fields
  applicationDeadline: string    // "YYYY-MM-DD"
  earlyDecisionDeadline: string | null
  requiresTestScore: boolean
  avgAidPackage: number
  pctReceivingAid: number        // 0–1
  specialNotes: string[]         // e.g. "Foster youth tuition waiver available", "Tribal college — IHS scholarships apply"
  dataYear: number               // for disclosure
}
```

**15 schools selected:**
| School | State | Type | Key Persona |
|---|---|---|---|
| City College of San Francisco | CA | CC | Mateo, Persona B (DACA) |
| East Los Angeles College | CA | CC | Persona B |
| Diné College | NM | Tribal | Eli |
| Wilbur Wright College | IL | CC | Maya |
| Austin Community College | TX | CC | General |
| Virginia Western Community College | VA | CC | Shauna, Persona A |
| UC Davis | CA | 4-yr public | Persona B, Eli |
| CSU Fullerton | CA | 4-yr public | Persona B |
| UNM (Univ. of New Mexico) | NM | 4-yr public | Eli |
| Radford University | VA | 4-yr public | Shauna, Persona A |
| DePaul University | IL | 4-yr private | Maya |
| Northwestern University | IL | 4-yr private | Maya |
| CalArts | CA | Arts | Elena |
| SCAD (Savannah) | GA | Arts | Elena |
| RISD | RI | Arts | Elena |

### 3.2 Personas (10 synthetic)

All derived from research document. Each includes: name, grade, state, background, goal, key barriers, special circumstances, and a set of sample opening prompts.

| # | Name | Grade | Situation | Primary Intent |
|---|------|-------|-----------|----------------|
| 1 | Mateo | 10 | First-gen CC transfer, dual enrollment, CA | pathway_recommendation |
| 2 | Chloe | 12 | Unaccompanied homeless youth, FAFSA w/o parents | application_prep |
| 3 | Shauna | 11 | Teen mother, rural VA, nursing goal, childcare | program_comparison |
| 4 | Nick | 12 | Post-juvenile detention, carpentry/architecture, NJ | career_exploration |
| 5 | Maya | 11 | Foster youth aging out, IL, Chafee ETV | application_prep |
| 6 | Eli | 11 | Navajo Nation NM, nursing, unreliable internet | pathway_recommendation |
| 7 | Henry | 11 | Military-to-college pathway (ROTC/GI Bill) | pathway_recommendation |
| 8 | Elena | 12 | Animation/arts programs, academic magnet school | program_comparison |
| 9 | Persona A | 11 | Rural Appalachia, nursing, above Pell threshold | program_comparison |
| 10 | Persona B | 12 | DACA-eligible, CA, 3.6 GPA, CADAA vs FAFSA | application_prep |

---

## 4. Orchestration Flow

Per request to `POST /api/chat`:

```
1. Input guardrails
   - PII scan: regex for SSN, address patterns → strip or warn
   - Injection detection: check for system prompt override attempts → block

2. Intent classification (Claude, fast prompt, ~200 tokens)
   - Returns one of: profile_collection | career_exploration | program_comparison
                     | pathway_recommendation | application_prep | general_question

3. Query rewriting (Claude, with session context)
   - Resolve references ("that school" → specific school name)
   - Extract structured params (state, budget, degree level, CIP code)
   - Determine which data sources to activate

4. Data retrieval (parallel where possible)
   - career_exploration → O*NET keyword/RIASEC search
   - program_comparison → College Scorecard + school RAG
   - pathway_recommendation → O*NET + College Scorecard + school RAG
   - application_prep → school RAG (CDS) + College Scorecard (cost context)
   - profile_collection / general_question → no external retrieval

5. Prompt assembly (prompt-builder.ts)
   - System prompt (persona, guardrails, format rules — see §5)
   - Student profile context (from session memory)
   - Retrieved data (formatted as markdown tables or JSON snippets)
   - Conversation history (last N turns)
   - Rewritten query + intent metadata

6. Claude streaming
   - Model: claude-sonnet-4-6
   - Stream via Vercel AI SDK or raw ReadableStream

7. Output guardrails
   - Hallucination check: verify cited numbers appear in retrieved data
   - PII filter: ensure no student data in response
   - Format validation: if structured component expected, verify JSON block present
   - Uncertainty disclosure: if data not retrieved, model must caveat

8. Response to frontend
   - Stream chat text
   - Emit structured component JSON if present (comparison table, checklist, pathway cards)
   - Update session memory (student profile fields, prior recommendations)
```

### 4.1 Session State

```typescript
interface SessionState {
  sessionId: string
  personaId: string | null          // if demo mode
  studentProfile: StudentProfile    // built up incrementally
  conversationHistory: Message[]
  priorRecommendations: string[]    // school/program names mentioned
  retrievalCache: Map<string, any>  // avoid duplicate API calls within session
  createdAt: number
  lastActiveAt: number
}

interface StudentProfile {
  grade: number | null
  state: string | null
  interests: string[]
  academicInfo: { gpa?: number; satScore?: number; testOptional?: boolean }
  financialInfo: { incomeRange?: string; pellEligible?: boolean; hasParentalSupport?: boolean }
  constraints: string[]             // e.g. "childcare", "unreliable internet", "no parental contact"
  specialCircumstances: string[]    // e.g. "foster youth", "undocumented", "homeless youth"
  goals: string[]
  programInterests: string[]        // CIP areas of interest
}
```

Sessions are ephemeral (in-memory Map). No data persists after session ends.

---

## 5. System Prompt Design

Based on research findings, the system prompt encodes these behaviors:

**Always:**
- Ask 1–2 targeted clarifying questions before giving advice when profile is incomplete
- Use plain language — define any term that could be jargon (e.g. "articulation agreement," "SAI," "EFC")
- Structure responses as action plans with numbered steps
- Present all viable pathway types equally: CC, 4-year, trade, tribal, military, apprenticeship
- Acknowledge real-world constraints (childcare, internet access, housing instability) and adapt advice accordingly
- Include fallback/failure scenario: "If X doesn't work out, here's what to do next"
- Cite data year and note when data may be outdated
- Validate the student's situation with empathy before giving information

**Never:**
- Default to 4-year college as the obvious best path
- Suggest FAFSA to undocumented students (use CADAA/Dream Act for CA)
- Stack aid sources without noting restrictions
- Ignore constraints the student has mentioned
- Use motivational language as a substitute for concrete next steps

---

## 6. Frontend — UI Components

### 6.1 Landing / Persona Selector (`/`)
- 10 persona cards with name, grade, situation summary, key challenge badge
- "Start fresh (anonymous)" option
- Selecting a persona seeds session memory with that persona's profile

### 6.2 Chat Interface (`/chat/[sessionId]`)
- **Left sidebar**: ProfilePanel — shows student profile building up in real time as Claude extracts info
- **Center**: MessageBubble stream with markdown rendering
- **Inline panels** injected into chat flow based on intent:
  - `ComparisonTable` — side-by-side school/program view (cost, grad rate, outcomes, deadlines)
  - `PathwayCards` — 2–4 recommended pathways with key stats and "Learn more" CTAs
  - `TimelineChecklist` — week-by-week action plan with checkable items

### 6.3 Structured Component Protocol
Claude includes a JSON block in its response when a structured component is warranted:

```
<!-- COMPONENT:comparison_table -->
{"schools": [...], "fields": ["tuition", "gradRate", "medianEarnings"]}
<!-- /COMPONENT -->
```

The frontend parses this and renders the appropriate React component in place of the raw JSON.

---

## 7. Error Handling & Graceful Degradation

| Failure | Behavior |
|---|---|
| College Scorecard API down | Serve school RAG data only; disclose in response |
| O*NET API down | Fall back to Claude general knowledge; disclose |
| Claude API error | Return 503, surface user-friendly message |
| Session not found | Create new session, inform user history was lost |
| Data vintage concern | Automatically append "Data from [year] — verify with school directly" |

---

## 8. Environment Variables

```bash
ANTHROPIC_API_KEY=          # Claude API
COLLEGE_SCORECARD_API_KEY=  # api.data.gov (free)
ONET_USERNAME=              # onetcenter.org (free)
ONET_PASSWORD=              # onetcenter.org (free)
```

---

## 9. Known MVP Constraints

| Gap | Mitigation |
|---|---|
| No live deadline data | Curate deadlines in school JSON; label data year in responses |
| O*NET salary is national only | Disclose national scope; supplement with BLS note |
| IPEDS/CDS data is synthetic | Based on real data patterns; label as approximate |
| RAG is in-memory (no embeddings) | Keyword + metadata filtering on school JSON; Pinecone-ready interface |
| Session memory is ephemeral | No persistence across sessions; disclosed to user |
| No state-specific financial aid data beyond CA/CADAA | Claude general knowledge + links to state aid agency sites |

---

## 10. Out of Scope for MVP

- Real IPEDS CSV ingestion pipeline
- Vector embeddings / semantic search
- User accounts or persistent sessions
- State-specific scholarship databases (beyond what's in curated school notes)
- Non-degree pathways (bootcamps, apprenticeship directories) — data not available
