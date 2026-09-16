# Pathway: AI College & Career Advising Prototype

Pathway is a full-stack advising prototype built for the Bill & Melinda Gates Foundation. It gives students a conversational workspace for college and career planning, while letting parents, counselors, and mentors join with role-specific context.

The product is designed around a simple idea: students should be able to ask messy real questions like "Can I afford college?" or "What careers match my interests?" and get answers grounded in real education and labor-market data.

## Highlights

- Student and adult workspaces with separate prompts, permissions, and UI flows.
- AI advising chat backed by College Scorecard, IPEDS, Common Data Set, and O*NET data.
- Custom RAG layer using OpenAI embeddings and Pinecone for institution-level retrieval, with an in-memory fallback for local demos.
- Structured workbench components for school comparisons, financial-aid estimates, decision matrices, pathway cards, timelines, FAFSA drafts, and essay drafts.
- Share-and-claim flow that lets a student invite a parent, counselor, or mentor through a time-bounded link.
- Portable student memory export/import for conversations, profile data, and trust events.
- Trust layer with citations, source disclosure, intent detection, adaptive tone signals, and rubric-based response scoring.

## Why I Built It

College guidance often assumes students already know what to ask, which schools to compare, and how to interpret cost, outcomes, and admissions data. Pathway turns that process into a guided workspace: the student can start with uncertainty, refine their goals, invite trusted adults, and keep all advising context in one place.

## Data & RAG

Pathway combines live API data with pre-indexed school profiles:

- **College Scorecard**: tuition, net price, graduation rates, earnings, debt, admissions, and program-level outcomes.
- **IPEDS**: institution metadata, cost, completion, enrollment, and federal higher-education statistics.
- **Common Data Set**: school-specific admissions, aid, deadline, and student-body context where available.
- **O*NET**: occupation search, job zones, wages, skills, and task data for career exploration.

The RAG pipeline converts IPEDS and Common Data Set records into natural-language school profiles, embeds them with OpenAI, and stores them in Pinecone under a `schools` namespace. At query time, the app retrieves the top matching institutions, applies metadata filters such as state and school type, and passes grounded school facts into the advising prompt.

If Pinecone credentials are not configured, the app falls back to a small in-memory school dataset so the demo still runs locally.

## Product Flow

1. A student chooses their identity and opens a workspace.
2. The advisor responds to questions about affordability, fit, admissions, careers, or next steps.
3. The workbench renders structured tools when prose is not enough, such as cost comparisons or decision matrices.
4. The right rail tracks profile details, journey phase, deadlines, and "How we got here" explanations.
5. The student can share their context with a parent, counselor, or mentor.
6. Adults get their own workspace with pinned student context and role-aware guidance.
7. The student can export their memory and restore it later.

## Tech Stack

- **Framework**: Next.js 16 App Router, React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **AI**: Anthropic SDK for chat, rubric judging, and tone classification
- **Retrieval**: OpenAI embeddings + Pinecone vector search
- **Data**: College Scorecard API, IPEDS, Common Data Set, O*NET Web Services
- **Storage**: SQLite through `node:sqlite`, with optional Turso/libSQL support
- **Testing**: Vitest

## Run Locally

Requires Node `>=22.13` and pnpm `10.22.0`.

```bash
pnpm install
cp .env.local.example .env.local
pnpm seed:demo
SQLITE_PATH=./data/pathwayai.demo.db pnpm dev
```

Open `http://localhost:3000` and choose a student or adult role.

## Environment Variables

Create `.env.local` from `.env.local.example`:

```bash
ANTHROPIC_API_KEY=your_anthropic_key_here
COLLEGE_SCORECARD_API_KEY=your_scorecard_key_here
ONET_API_KEY=your_onet_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=pathwayai-schools
OPENAI_API_KEY=your_openai_api_key_here
```

Do not commit `.env.local`. The repository includes only placeholder values in `.env.local.example`.

## Useful Commands

```bash
pnpm dev              # Start the development server
pnpm dev:webpack      # Start Next.js with webpack instead of Turbopack
pnpm build            # Production build
pnpm test             # Run Vitest
pnpm typecheck        # Run TypeScript checks
pnpm seed:demo        # Create a local demo SQLite database
pnpm ingest:ipeds     # Embed and index IPEDS school records
pnpm ingest:cds       # Embed and index Common Data Set records
pnpm verify:pinecone  # Check Pinecone index configuration
pnpm eval:run         # Run advising quality and bias evaluations
```

## Demo Script

See `docs/demo-walkthrough.md` for a 10-minute demo covering:

- student onboarding,
- affordability advising,
- financial-aid workbench tools,
- parent/counselor sharing,
- role-aware adult advising,
- FAFSA draft generation,
- memory export/import,
- citations and trust explanations.

## Security Notes

- `.env.local`, SQLite database files, raw IPEDS downloads, and generated eval reports are ignored by Git.
- API keys are read from environment variables only.
- Share links use generated tokens and expiration timestamps.
- The FAFSA and essay tools generate drafts only; the app does not submit forms or applications for students.

## Repository Structure

```text
src/app/                 Next.js routes and API handlers
src/components/          Student, adult, workbench, trust, and UI components
src/lib/services/        RAG, embeddings, Scorecard, and O*NET integrations
src/lib/orchestration/   Prompting, intent detection, guardrails, citations
src/lib/db/              SQLite/libSQL adapters and query layer
scripts/                 Data ingest, demo seeding, eval, and verification scripts
tests/                   API, DB, orchestration, service, and component tests
docs/                    Demo walkthrough, design specs, and implementation plans
```
