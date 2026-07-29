# Persistent DB + robustness fixes (2026-07-28)

## Problem

Deployed on Vercel, every route is its own serverless function with a private,
ephemeral `/tmp` SQLite database seeded independently from the demo snapshot.
Writes from one route are invisible to every other route (and to other
instances of the same route). Verified in prod:

- `POST /api/identity` creates a student; `/student/[id]` (different function)
  can't see it → silent `redirect('/')` → "can't create a new profile".
- The student page creates a conversation in *its* DB; `/api/chat` can't see it
  and the client sends no `studentId` → 400 → "chat interface unusable".
- `POST /api/identity` (adult) succeeds; `/adult/[id]` can't see the adult →
  redirect home → "caring adults tab does not work".

All three flows verified working locally (single shared DB file) — no local
functional bugs in the flows themselves. Secondary robustness gaps exist in
client components (no `res.ok` handling, `busy` never reset, crash on
undefined lists).

## Fix architecture

### 1. Async dual-backend data layer (`src/lib/db/index.ts`)

An async adapter interface with two backends, selected by env:

- **`TURSO_DATABASE_URL` set** → `@libsql/client` (Turso hosted libSQL —
  SQLite dialect over HTTP, shared by all functions/instances). Auth via
  `TURSO_AUTH_TOKEN`.
- **Otherwise** → `node:sqlite` wrapped in async methods. Local dev, tests,
  scripts, and the (degraded) Vercel `/tmp` fallback keep working with zero
  external accounts.

```ts
interface DbAdapter {
  all<T>(sql: string, params?: SQLInputValue[]): Promise<T[]>
  get<T>(sql: string, params?: SQLInputValue[]): Promise<T | undefined>
  run(sql: string, params?: SQLInputValue[]): Promise<void>
  batch(stmts: { sql: string; params?: SQLInputValue[] }[]): Promise<void> // atomic
  execMultiple(sql: string): Promise<void> // migrations
}
```

- `runMigrations()` becomes async, runs once per process (`_migrated` flag
  stays). PRAGMA statements are filtered out for the libsql backend (Turso
  manages journal mode; `foreign_keys` set per-connection where supported).
- `transact(fn)` is removed; its three call sites (createStudent,
  appendMessage, appendAdultMessage) become `batch()` calls — each is exactly
  two statements, so `batch` preserves atomicity.
- Vercel `/tmp` + demo-seed fallback behavior is kept for the no-Turso case.

### 2. `queries.ts` → async

All 25 exported functions become async (`await adapter.get/all/run/batch`).
Row-shape post-processing (`plain()`) is kept for node:sqlite; libsql rows are
converted to plain objects the same way.

### 3. Callers (16 source files + seed script + 6 test files)

Add `await` at every call site; containing functions become async (server
components and route handlers already are). Files:

- pages: `student/[studentId]` (entry, `[conversationId]`, `plan`),
  `adult/[adultId]` (home, `student/[studentId]`)
- api routes: `chat`, `adult/chat`, `claim`, `conversations/[id]/workbench`,
  `identity`, `import`, `share`, `student/[id]/{conversations,export,selections}`
- lib: `orchestration/session.ts`, `orchestration/pinned-summary.ts`,
  `orchestration/plan.ts`
- `scripts/seed-demo.ts`
- tests: `tests/db/*` (3), `tests/orchestration/{plan,session}.test.ts`,
  `tests/components/profile-panel.test.ts`

Client components import only types from `queries.ts` — no changes forced.

### 4. Client robustness

- **IdentityPicker**: check `res.ok`, show inline error, reset `busy` on
  failure, guard `j.students ?? []`, don't `router.push` on undefined id.
- **ChatInterface**: send `studentId` with every chat POST (self-healing if a
  conversation is missing server-side); surface non-OK responses as a visible
  error message instead of silently breaking the stream reader.
- Additional confirmed findings from the bug-hunt workflow folded in here.

### 5. Tests

- Fix the 8 stale `tests/api/chat-route.test.ts` cases (send `studentId` /
  pre-create the conversation to match the current route contract).
- Update DB-touching tests for async signatures.

### 6. Deploy + activation

- Ship the refactor to Vercel (works degraded without Turso, exactly as today).
- User provisions Turso (free): create DB, set `TURSO_DATABASE_URL` +
  `TURSO_AUTH_TOKEN` in Vercel env → redeploy → all routes share one
  persistent DB; all three reported bugs disappear; data survives cold starts.

## Non-goals

- No Postgres migration (libSQL keeps the SQLite dialect byte-identical).
- No auth/multi-tenancy work beyond current prototype behavior.
