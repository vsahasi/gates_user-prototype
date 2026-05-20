# PathwayAI — College & Career Advising Prototype

A dual-workspace prototype for college and career advising, built for the Bill & Melinda Gates Foundation. Students chat with an advisor, edit their profile inline, see structured comparisons / decision matrices / financial-aid views, and share context with parents or counselors who get their own assistant scoped to that student.

## Run locally

Requires **Node 22.5+** for the built-in `node:sqlite` module.

```bash
pnpm install
cp .env.local.example .env.local   # fill in API keys
pnpm seed:demo                     # creates data/pathwayai.demo.db with sample students
SQLITE_PATH=./data/pathwayai.demo.db pnpm dev
```

Open http://localhost:3000 and pick a role.

## What's inside

- **Student workspace** (`/student/[id]/[conversationId]`) — left rail (conversations, share, export, switch role), center chat + workbench (comparisons, pathways, timelines, decision matrix, financial-aid view, FAFSA + essay drafts), right rail (editable profile, journey tracker).
- **Adult workspace** (`/adult/[id]/student/[studentId]`) — pinned student context up top, adult-scoped assistant below. Adults are parents, counselors, or other caring adults; the system prompt adapts.
- **Share + claim** — students click "Share" to issue a time-bounded link; the adult opens it, picks a role, and is linked. Multi-adult per student.
- **Memory portability** — "Export my memory" downloads a JSON bundle (profile + conversations + trust events). `/import` restores it onto a fresh identity.
- **Adaptive UX** — every assistant turn carries signals (tone, readiness, cognitive load, deadline pressure) computed from the message + history + profile. The system prompt and UI density respond to overwhelm / urgency.
- **Trust layer** — assistant cites Scorecard/IPEDS/O*NET facts inline with `[cite: …]` markers (extracted into footnotes); rubric scorer (Opus-as-judge) tags high-quality answers; "How we got here" panel discloses intent + signals + sources.

## Architecture

- Next.js 16 (App Router), React 19, Tailwind v4, TypeScript
- SQLite via `node:sqlite` (built in; no native compile). DB file: `data/pathwayai.db`.
- Anthropic SDK — Claude Opus 4.7 (rubric judge), Sonnet 4.6 (chat), Haiku 4.5 (tone classifier).
- RAG: OpenAI embeddings → Pinecone, falls back to in-memory school dataset when key missing.

Full design in `docs/superpowers/specs/2026-05-19-ui-revamp-design.md`. Implementation plan in `docs/superpowers/plans/2026-05-19-ui-revamp.md`.

## Commands

- `pnpm dev` — dev server
- `pnpm test` — vitest
- `pnpm typecheck` — tsc
- `pnpm seed:demo` — populate `data/pathwayai.demo.db` with two sample students + linked adults
- `pnpm ingest:ipeds` / `pnpm ingest:cds` — index institutional data into Pinecone
- `pnpm eval:run` — accuracy + rubric + bias eval (when fixtures present)

## Demo walkthrough

See `docs/demo-walkthrough.md` for the scripted demo flow.
