# UI Revamp + Memory, Trust, Family/Counselor — Design Spec

**Date:** 2026-05-19
**Status:** Approved (architecture + data model); remaining sections written from decisions captured during brainstorming
**Project:** Gates Foundation College & Career Advising Prototype (final-demo wrap-up)

---

## 1. Goals

Address the post-demo feedback in a single coherent redesign:

1. **UI / engagement** — more interactive, clearer, easier to use; inline-editable panels; better visualizations beyond option cards; tone- and phase-aware UI.
2. **Memory & persistence** — durable across sessions; portable (export/import); revocable sharing with adults.
3. **Family / counselor engagement** — adults can view a student's pinned context AND have their own assistant scoped to that student.
4. **Adaptive UX** — react in-the-moment to tone, readiness, cognitive load, and deadline pressure.
5. **Trust layer** — offline bias + good-advice eval harness + in-app provenance signals (citations, "reviewed by advisor" badges, "how we got here" disclosure).
6. **Agentic drafting** — assistant drafts FAFSA answers, application essays, plans, scholarship lists; never submits.
7. **Mid-point feedback** — addresses the five challenges (accuracy/auditability, tone, engagement, agentic guardrails, memory/portability).

Non-goals for this build: real OAuth, real form submissions to FAFSA/Common App, native mobile, full multi-tenant SaaS.

---

## 2. Architecture

**Two workspaces, one backend.**

- **Student workspace** (`/student/[studentId]`)
  - **Left rail:** conversation list, "+ New conversation," share button, role switcher (back to landing), export-memory button.
  - **Center workbench:** chat thread on top, swappable visualization slot below (Comparison, Pathways, Timeline, Decision Matrix, FAFSA Draft, Essay Draft). The slot is driven by structured-component messages — same plumbing as today, expanded.
  - **Right rail:** editable profile, journey tracker (real readiness signals, not just message count), trust panel (citations + "reviewed against advisor rubric" + "how we got here").
- **Adult workspace** (`/adult/[adultId]/student/[studentId]`)
  - **Top:** pinned student context — profile snapshot, current journey phase, recent conversation summary, recent decisions. Read-only.
  - **Below:** the adult's own assistant, scoped to questions *about* that student. Examples: "What should I be asking my kid right now?" "What's a fair financial trade-off here?"
  - **Adult home** (`/adult/[adultId]`): list of linked students with last-activity timestamps.
- **Landing** (`/`): role picker (student vs. parent/counselor) + identity picker (existing test identities from a dropdown, or "Start fresh"). Sets a cookie. Persona presets remain available for student identities.

**Shared backend:** Next.js API routes + SQLite via `better-sqlite3`. Single DB file `data/pathwayai.db`. Migrations in `db/migrations/`.

**Background processes:** eval harness as a `tsx` script (`scripts/eval-run.ts`) — not in the request path. Writes JSON reports to `eval/reports/`. A minimal in-app dashboard at `/eval` renders the latest report (for the deck/demo).

---

## 3. Data model

SQLite. Profile is a single JSON blob per student so we can keep the existing `StudentProfile` type without flattening.

```
students            id TEXT PK, displayName TEXT, personaId TEXT NULL,
                    pinnedSummaryJson TEXT NULL, summaryUpdatedAt INTEGER NULL,
                    createdAt INTEGER
adults              id TEXT PK, displayName TEXT, kind TEXT CHECK(kind IN
                    ('parent','counselor','other')), createdAt INTEGER
student_profiles    studentId TEXT PK REFERENCES students(id),
                    profileJson TEXT, updatedAt INTEGER
links               id TEXT PK, studentId TEXT, adultId TEXT,
                    role TEXT, status TEXT CHECK(status IN ('pending','active','revoked')),
                    createdAt INTEGER, UNIQUE(studentId, adultId)
conversations       id TEXT PK, studentId TEXT, title TEXT, phase TEXT,
                    workbenchStateJson TEXT NULL,
                    lastMessageAt INTEGER, createdAt INTEGER
messages            id TEXT PK, conversationId TEXT, role TEXT, content TEXT,
                    structuredComponentJson TEXT NULL, citationsJson TEXT NULL,
                    signalsJson TEXT NULL, rubricScoreJson TEXT NULL,
                    timestamp INTEGER
adult_conversations id TEXT PK, adultId TEXT, studentId TEXT, lastMessageAt INTEGER
adult_messages      id TEXT PK, adultConvId TEXT, role TEXT, content TEXT, timestamp INTEGER
trust_events        id TEXT PK, messageId TEXT, type TEXT, payloadJson TEXT, createdAt INTEGER
share_tokens        token TEXT PK, studentId TEXT,
                    kind TEXT CHECK(kind IN ('parent','counselor','other')),
                    expiresAt INTEGER, claimedByAdultId TEXT NULL
eval_runs           id TEXT PK, startedAt INTEGER, finishedAt INTEGER NULL,
                    summaryJson TEXT NULL, reportPath TEXT
```

All `id` and `token` fields are `nanoid()` strings. Foreign keys enforced. SQLite WAL mode for concurrent reads during the demo.

**Session module rewrite:** `src/lib/orchestration/session.ts` keeps its current public functions (`getOrCreateSession`, `updateStudentProfile`, `setStudentProfile`) but reads/writes through the DB instead of the in-memory `Map`. A new `src/lib/db/` module owns connection + queries.

---

## 4. Memory & portability

- **Persistence:** every user/assistant message persists immediately. Profile edits persist on blur/Update. No data lives only in client state.
- **Export memory:** student clicks "Export" in left rail → server bundles `{ profile, conversations[], trust_events[] }` into a single JSON, returned as a download.
- **Import memory:** on the landing page, "Restore from export" accepts the JSON, creates a new student row, inserts profile + conversations + trust events.
- **Revocation:** student "Sharing" screen lists active links; revoking flips `links.status = 'revoked'` and invalidates outstanding share tokens for that adult.
- **Pinned summary:** when an adult opens the student workspace, the server computes/refreshes a pinned summary (top 3 schools, current phase, open questions, deadlines next 60 days). Cached in `students.pinnedSummaryJson` (added to schema) with `summaryUpdatedAt`. Refreshed on student message or every 24h, whichever is first.

---

## 5. Editable two-way panels (workbench)

The visualization slot in the workbench renders one of these panel types at a time, driven by structured-component messages (existing mechanism, extended):

| Panel | Drives | Editable inputs that round-trip into chat |
|---|---|---|
| ComparisonTable | School comparison | Add/remove school; toggle which fields to show; "Why did you pick these?" reopens chat |
| PathwayCards | Career/major exploration | Mark "interested" / "not for me"; flag drives next assistant turn |
| DecisionMatrix (new) | Weighted trade-offs | Sliders for each criterion (cost, fit, location, prestige); recompute ranking client-side; "Explain this ranking" sends weights to chat |
| TimelineChecklist | Application timeline | Check items, add custom items, change due dates; sync back to profile.deadlines |
| FAFSADraft (new) | FAFSA answer draft | Edit fields inline; "What does this question mean?" opens an explainer panel |
| EssayDraft (new) | Personal statement | Edit prose; "Tighten this paragraph" / "Show me three angles" buttons send prompts |
| FinancialAidView (new) | Net-price comparison | Family income slider; recompute Scorecard net-price predictions; "Walk me through this number" |

**Two-way binding:** any panel edit (a) writes through to the relevant slice of `StudentProfile` or a new `WorkbenchState` JSON blob on the conversation, and (b) is visible to the next assistant turn via the prompt builder.

**Chat ↔ panel switching:** the chat always remains scrollable above the workbench; clicking a structured component in chat re-pins it to the workbench slot. "Back to conversation" collapses the slot.

---

## 6. Adaptive UX layer

A lightweight `src/lib/adaptive/signals.ts` module derives signals from the current message + conversation history + profile:

- **Tone signal** — `calm | anxious | overwhelmed | excited | confused`. Detected with a tiny Claude Haiku classifier call (cheap, in-process) on the latest user message. Updates the system-prompt tone directive (existing `prompt-builder.ts` gains a `tone` parameter) and adjusts UI density (more whitespace, fewer chips when overwhelmed).
- **Readiness signal** — `exploring | weighing | deciding | acting`. Derived from intent classifier output + presence of concrete entities in profile (schools shortlisted, deadlines added). Drives the journey tracker and which workbench panels are suggested.
- **Cognitive load signal** — `low | medium | high`. Heuristic: topic churn rate over last N turns + average user message length trend. High load suppresses the right rail and narrows the workbench.
- **Deadline pressure signal** — `none | upcoming | imminent`. If any profile deadline is < 14 days away, a deadline strip appears above the workbench with the next two items. < 3 days → strip turns warm-red and the assistant proactively foregrounds it.

All four signals are computed once per assistant turn, stored on the message row (`messages.signalsJson`), and consumed by both the prompt builder and the client renderer.

**No bias toward over-adapting.** A "Hold tone steady" toggle in settings disables tone-modulation if the student finds it patronizing.

---

## 7. Trust layer: bias eval + in-app provenance

**Offline eval harness** (`scripts/eval-run.ts`):

- Fixture conversations in `eval/fixtures/`: synthetic student turns covering the persona set, plus the advisor-spreadsheet conversations from the email.
- For each fixture turn, run the prototype agent and capture the response.
- Score on three dimensions:
  - **Accuracy** — hard-checkable facts (deadlines, tuition, admit rates) against ground truth.
  - **Bias probes** — paired prompts that vary only on persona attributes (race, gender, income, first-gen) and check whether recommendations differ in inappropriate ways.
  - **Good-advice rubric** — LLM-as-judge (Claude Opus 4.7 as judge, agent under test is Sonnet 4.6) scoring against an advisor-quality rubric: empathy, accuracy, actionability, completeness, non-paternalism.
- Writes a JSON report to `eval/reports/YYYY-MM-DD-HHMM.json`.
- Renders the latest report at `/eval` (read-only page, accessible to anyone — fine for the demo).

**In-app trust signals:**

- **Citations on factual claims.** When the assistant references a Scorecard or O*NET fact, the prompt builder requires `[cite: source]` markers; the renderer turns them into hoverable chips. Stored in `messages.citationsJson`.
- **"Reviewed by advisor rubric" badge.** Messages whose live rubric score is above threshold (computed asynchronously after generation by a background rubric call) get a small green badge. Below threshold → no badge.
- **"How we got here" panel.** Right-rail accordion showing, for the most recent assistant turn: detected intent, signals, RAG sources used, citations. Closed by default.
- **Source freshness.** Every Scorecard/O*NET answer shows the `dataYear`. IPEDS/CDS chunks already carry year metadata.

---

## 8. Agentic drafting (guide + draft, never submit)

- New panels: **FAFSADraft**, **EssayDraft**. Each is a structured component the assistant can emit.
- Drafts persist on `conversations.workbenchStateJson`.
- "Export draft" downloads markdown (essay) or a structured PDF/markdown (FAFSA answers).
- **No outbound submission anywhere.** Every draft surface has a visible "This is a draft. We do not submit anything on your behalf." disclosure.
- **Co-signer flow (light):** student can request review from a linked adult. Adult sees the draft in their workspace with inline comment markers. Comments persist on `trust_events` with `type='adult_review'`.

---

## 9. Family / counselor surface

- **Share flow:** student clicks "Share" → modal: choose role (parent / counselor / other), set expiration (24h / 7d / 30d), generate link. Link is `/claim/[token]`.
- **Claim flow:** adult opens link → picks an adult identity (existing or new) → claim writes to `links` and clears `share_tokens.claimedByAdultId`.
- **Adult workspace** (described in §2):
  - Pinned context up top.
  - Adult-side chat below, with system prompt scoped to "you are advising the parent/counselor of <studentName>, who has this profile and is at this stage." Adult chat can reference but never write to the student's profile.
  - "Suggest message to student" — adult composes a message the student sees in their next session as a pinned note ("Your counselor suggested asking about…").
- **Counselor mode-vs-parent mode:** same surface, different system prompt (counselor gets more professional/clinical tone; parent gets warmer/coaching). Driven by `adults.kind`.

---

## 10. File / component changes (high level)

New files:
- `src/lib/db/index.ts`, `src/lib/db/queries.ts`, `db/migrations/0001_init.sql`
- `src/lib/adaptive/signals.ts`, `src/lib/adaptive/tone.ts`
- `src/lib/orchestration/citation-extractor.ts`
- `src/lib/orchestration/rubric.ts`
- `src/components/workbench/Workbench.tsx`, `DecisionMatrix.tsx`, `FAFSADraft.tsx`, `EssayDraft.tsx`, `FinancialAidView.tsx`
- `src/components/layout/LeftRail.tsx`, `src/components/layout/RightRail.tsx`, `src/components/layout/DeadlineStrip.tsx`
- `src/components/trust/HowWeGotHere.tsx`, `src/components/trust/CitationChip.tsx`, `src/components/trust/AdvisorBadge.tsx`
- `src/app/adult/[adultId]/page.tsx`, `src/app/adult/[adultId]/student/[studentId]/page.tsx`
- `src/app/claim/[token]/page.tsx`
- `src/app/api/share/route.ts`, `src/app/api/claim/route.ts`, `src/app/api/export/route.ts`, `src/app/api/import/route.ts`
- `src/app/api/adult/chat/route.ts`
- `src/app/eval/page.tsx`, `scripts/eval-run.ts`, `eval/fixtures/*.json`, `eval/rubric.md`

Modified:
- `src/lib/orchestration/session.ts` — DB-backed
- `src/lib/orchestration/prompt-builder.ts` — accepts `tone`, `signals`, requires citation markers
- `src/lib/orchestration/intent.ts` — returns readiness signal
- `src/components/chat/ChatInterface.tsx` — becomes the student workspace shell; old structure moves into `Workbench.tsx`
- `src/app/page.tsx` — role picker landing
- `src/lib/types.ts` — `Adult`, `Link`, `Signals`, `WorkbenchState`, `TrustEvent`, `Citation`, `RubricScore`
- `src/app/api/chat/route.ts` — persists messages, attaches signals/citations

---

## 11. Testing strategy

- **Unit tests (vitest)**:
  - `db/queries.test.ts` — round-trip CRUD for each table; FK enforcement; share-token claim flow.
  - `adaptive/signals.test.ts` — deterministic fixtures for tone, readiness, cognitive-load, deadline-pressure.
  - `orchestration/citation-extractor.test.ts` — pulls `[cite: …]` markers out of streamed text.
  - `orchestration/rubric.test.ts` — given a fixture response, scores against rubric (with mocked judge).
  - Existing tests (`chunk-formatters`, `profile-panel`, `structured-component`) continue to pass.
- **Integration tests**:
  - Student message → DB write → next request reads it back.
  - Share token issued → adult claim → link is `active`.
  - Export → import → identical state.
- **Eval harness as continuous test:** new `eval:run` and `eval:smoke` scripts added to `package.json`. `eval:smoke` is a fast subset that runs in pre-commit. Full `eval:run` is manual / scheduled; output written to `eval/reports/`. A baseline JSON checked into the repo lets `eval:smoke` flag regressions > 5% on a small fixed set.
- **Manual checklist for the demo:** scripted walk-through (student persona arrives → conversation → drafts → shares with parent → parent's view → counselor's view → export memory → restore on new identity).

---

## 12. Phasing (within this single build)

Sequenced so each phase leaves the app demoable:

1. **DB + session migration.** Replace in-memory sessions with SQLite. No UI change. Existing chat keeps working.
2. **Landing + role picker + student workspace shell.** Left rail, right rail, workbench slot. Visual change; behavior preserved.
3. **Editable panels + new visualizations** (DecisionMatrix, FinancialAidView, FAFSADraft, EssayDraft).
4. **Adaptive signals + tone modulation + deadline strip.**
5. **Trust layer: citations, "how we got here," advisor badge.**
6. **Family/counselor: share, claim, adult workspace, adult chat.**
7. **Eval harness + `/eval` page.**
8. **Export/import memory.**
9. **Polish + manual demo walk-through + final commits.**

---

## 13. Risks / open questions

- **Demo data:** need a seeded SQLite (`data/pathwayai.demo.db`) with two students mid-conversation, one shared with a parent, one with a counselor.
- **Eval fixture set:** the advisor spreadsheet from the post-demo email is the most important fixture source; we need to lift it into `eval/fixtures/`.
- **Tone classifier cost:** one Haiku call per user message. Cheap, but worth caching when the user toggles a quick chip.
- **Rubric judge cost:** scored asynchronously after generation, so it doesn't block the stream. Failed scores degrade gracefully (no badge, no UI break).
- **Adult-side privacy:** counselors and parents see profile + conversations, not raw audit logs. Worth noting in the deck.

---

## 14. Self-review notes

Checked for placeholders (none), internal contradictions (none — adult chat correctly read-only on profile, write on `adult_conversations`), scope (large but single product, single repo, one build), and ambiguity (panel switching, share-token claim, signals storage all explicit).
