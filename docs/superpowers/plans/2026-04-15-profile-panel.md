# Profile Collection Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-visible editable profile sidebar to the chat UI that pre-fills from the selected persona and keeps the AI informed of the student's grade, state, GPA, interests, and goals.

**Architecture:** ChatInterface gains a two-column layout — a 280px sidebar with an editable ProfilePanel on the left, and the existing chat on the right. Profile state lives in ChatInterface, initialized from the persona's `initialProfile` prop passed from the page. Each chat API call includes the current profile so the server replaces the session profile rather than accumulating stale data from persona seeding.

**Tech Stack:** React (useState, useEffect), Next.js App Router, TypeScript, Tailwind CSS, Vitest (pure function tests only — no RTL setup)

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/chat/[sessionId]/page.tsx` | Pass `initialProfile` prop to ChatInterface |
| `src/components/chat/ChatInterface.tsx` | Add `initialProfile` prop, `profile` state, two-column layout, pass profile to API |
| `src/components/panels/ProfilePanel.tsx` | Full rewrite — editable panel with draft state and Update button |
| `src/lib/orchestration/session.ts` | Add `setStudentProfile` (replace, not merge) |
| `src/app/api/chat/route.ts` | Accept `profile` in request body, call `setStudentProfile` |
| `tests/components/profile-panel.test.ts` | Tests for `isDirty` and `mergeProfile` helpers |

---

## Task 1: Pass `initialProfile` to ChatInterface and initialize profile state

**Files:**
- Modify: `src/app/chat/[sessionId]/page.tsx`
- Modify: `src/components/chat/ChatInterface.tsx`
- Create: `tests/components/profile-panel.test.ts`

- [ ] **Step 1: Write the failing test for mergeProfile**

Create `tests/components/profile-panel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { StudentProfile } from '@/lib/types'

// Inline the helpers we'll extract from ChatInterface — test first
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

function mergeProfile(initial: Partial<StudentProfile>): StudentProfile {
  return {
    ...DEFAULT_PROFILE,
    ...initial,
    financialInfo: { ...DEFAULT_PROFILE.financialInfo, ...(initial.financialInfo ?? {}) },
  }
}

describe('mergeProfile', () => {
  it('returns defaults when initial is empty', () => {
    const result = mergeProfile({})
    expect(result.grade).toBeNull()
    expect(result.state).toBeNull()
    expect(result.interests).toEqual([])
    expect(result.goals).toEqual([])
  })

  it('applies scalar fields from initial', () => {
    const result = mergeProfile({ grade: 10, state: 'CA', gpa: 3.5 })
    expect(result.grade).toBe(10)
    expect(result.state).toBe('CA')
    expect(result.gpa).toBe(3.5)
  })

  it('applies array fields from initial', () => {
    const result = mergeProfile({ interests: ['business'], goals: ['transfer to 4-year'] })
    expect(result.interests).toEqual(['business'])
    expect(result.goals).toEqual(['transfer to 4-year'])
  })

  it('does not mutate the DEFAULT_PROFILE', () => {
    mergeProfile({ interests: ['test'] })
    expect(DEFAULT_PROFILE.interests).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/25veers/Desktop/cs projects/gates_user-prototype" && pnpm test tests/components/profile-panel.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/types'` or the functions being tested don't exist yet. (The test file exists but we haven't wired the exports.)

- [ ] **Step 3: Add `initialProfile` prop to ChatInterface and define the helpers**

Open `src/components/chat/ChatInterface.tsx`. Make these changes:

Add import at top:
```tsx
import type { StudentProfile } from '@/lib/types'
import { ProfilePanel } from '@/components/panels/ProfilePanel'
```

Replace the `ChatInterfaceProps` interface (lines 18–22):
```tsx
interface ChatInterfaceProps {
  sessionId: string
  personaId?: string
  personaName?: string
  initialProfile?: Partial<StudentProfile>
}
```

Add these constants just above the `ChatInterface` function declaration (after the `renderStructuredComponent` function):

```tsx
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

export function mergeProfile(initial: Partial<StudentProfile>): StudentProfile {
  return {
    ...DEFAULT_PROFILE,
    ...initial,
    financialInfo: { ...DEFAULT_PROFILE.financialInfo, ...(initial.financialInfo ?? {}) },
  }
}
```

Update the function signature:
```tsx
export function ChatInterface({ sessionId, personaId, personaName, initialProfile = {} }: ChatInterfaceProps) {
```

Add `profile` state inside the function, right after the existing state declarations:
```tsx
const [profile, setProfile] = useState<StudentProfile>(() => mergeProfile(initialProfile))
```

- [ ] **Step 4: Update the test to import `mergeProfile` from ChatInterface**

Replace the inline `DEFAULT_PROFILE` and `mergeProfile` in the test file with imports:

```ts
import { describe, it, expect } from 'vitest'
import { mergeProfile } from '@/components/chat/ChatInterface'

describe('mergeProfile', () => {
  it('returns defaults when initial is empty', () => {
    const result = mergeProfile({})
    expect(result.grade).toBeNull()
    expect(result.state).toBeNull()
    expect(result.interests).toEqual([])
    expect(result.goals).toEqual([])
  })

  it('applies scalar fields from initial', () => {
    const result = mergeProfile({ grade: 10, state: 'CA', gpa: 3.5 })
    expect(result.grade).toBe(10)
    expect(result.state).toBe('CA')
    expect(result.gpa).toBe(3.5)
  })

  it('applies array fields from initial', () => {
    const result = mergeProfile({ interests: ['business'], goals: ['transfer to 4-year'] })
    expect(result.interests).toEqual(['business'])
    expect(result.goals).toEqual(['transfer to 4-year'])
  })

  it('does not mutate default profile across calls', () => {
    mergeProfile({ interests: ['test'] })
    const result = mergeProfile({})
    expect(result.interests).toEqual([])
  })
})
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test tests/components/profile-panel.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 6: Pass `initialProfile` from the page**

Open `src/app/chat/[sessionId]/page.tsx`. Replace the `<ChatInterface ...>` render (lines 19–23):

```tsx
<ChatInterface
  sessionId={sessionId}
  personaId={personaId}
  personaName={persona?.name}
  initialProfile={persona?.initialProfile ?? {}}
/>
```

- [ ] **Step 7: Commit**

```bash
git add src/app/chat/[sessionId]/page.tsx src/components/chat/ChatInterface.tsx tests/components/profile-panel.test.ts
git commit -m "feat: add initialProfile prop and profile state to ChatInterface"
```

---

## Task 2: Pass profile to API and update session on each request

**Files:**
- Modify: `src/lib/orchestration/session.ts`
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Write the failing test for `setStudentProfile`**

Add to `tests/components/profile-panel.test.ts` (append after the existing describe block):

```ts
import { getOrCreateSession, setStudentProfile, getSession } from '@/lib/orchestration/session'
import type { StudentProfile } from '@/lib/types'

describe('setStudentProfile', () => {
  it('replaces the session profile entirely', () => {
    const sessionId = 'test-session-replace'
    getOrCreateSession(sessionId)
    setStudentProfile(sessionId, { grade: 11, state: 'TX', interests: ['nursing'] })
    const session = getSession(sessionId)!
    expect(session.studentProfile.grade).toBe(11)
    expect(session.studentProfile.state).toBe('TX')
    expect(session.studentProfile.interests).toEqual(['nursing'])
    expect(session.studentProfile.goals).toEqual([])
  })

  it('replaces interests (does not merge with existing)', () => {
    const sessionId = 'test-session-replace-interests'
    getOrCreateSession(sessionId)
    // First call sets interests
    setStudentProfile(sessionId, { interests: ['business', 'tech'] })
    // Second call should REPLACE, not append
    setStudentProfile(sessionId, { interests: ['nursing'] })
    const session = getSession(sessionId)!
    expect(session.studentProfile.interests).toEqual(['nursing'])
  })

  it('is a no-op for unknown session', () => {
    expect(() => setStudentProfile('nonexistent', { grade: 9 })).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/components/profile-panel.test.ts
```

Expected: FAIL — `setStudentProfile is not a function` (not exported from session.ts yet).

- [ ] **Step 3: Add `setStudentProfile` to session.ts**

Open `src/lib/orchestration/session.ts`. Add this function after `updateStudentProfile` (after line 72):

```ts
export function setStudentProfile(
  sessionId: string,
  profile: Partial<StudentProfile>
): void {
  const session = sessions.get(sessionId)
  if (!session) return
  session.studentProfile = {
    ...DEFAULT_PROFILE,
    ...profile,
    financialInfo: { ...DEFAULT_PROFILE.financialInfo, ...(profile.financialInfo ?? {}) },
  }
  session.lastActiveAt = Date.now()
}
```

Also export `getSession` — it's already defined at line 74 and exported. Confirm the export is there:
```ts
export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/components/profile-panel.test.ts
```

Expected: all tests PASS (mergeProfile × 4, setStudentProfile × 3).

- [ ] **Step 5: Accept `profile` in the API route and apply it**

Open `src/app/api/chat/route.ts`. Replace the destructure at line 18:

```ts
const { message, sessionId, personaId, profile } = body as {
  message: string
  sessionId: string
  personaId?: string
  profile?: Partial<StudentProfile>
}
```

Add `StudentProfile` to the import at line 12:
```ts
import type { Message, StudentProfile } from '@/lib/types'
```

Add `setStudentProfile` to the session import at line 4:
```ts
import { getOrCreateSession, updateSession, updateStudentProfile, setStudentProfile } from '@/lib/orchestration/session'
```

Replace the existing persona-seeding block (lines 34–39):
```ts
// Apply client-provided profile (authoritative) or seed from persona on first message
if (profile) {
  setStudentProfile(sessionId, profile)
} else if (personaId && session.conversationHistory.length === 0) {
  const persona = getPersonaById(personaId)
  if (persona?.initialProfile) {
    updateStudentProfile(sessionId, persona.initialProfile as Parameters<typeof updateStudentProfile>[1])
  }
}
```

- [ ] **Step 6: Update ChatInterface to send profile with each fetch**

Open `src/components/chat/ChatInterface.tsx`. In the `sendMessage` function, replace the `body` of the fetch (line 100):

```tsx
body: JSON.stringify({ message: text, sessionId, personaId, profile }),
```

- [ ] **Step 7: Run all tests**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/orchestration/session.ts src/app/api/chat/route.ts src/components/chat/ChatInterface.tsx tests/components/profile-panel.test.ts
git commit -m "feat: sync profile to session on every chat request"
```

---

## Task 3: Restructure ChatInterface to two-column layout

**Files:**
- Modify: `src/components/chat/ChatInterface.tsx` (return JSX only)

No automated test for this task — it's a visual layout change. Verify manually.

- [ ] **Step 1: Replace the return JSX in ChatInterface**

Open `src/components/chat/ChatInterface.tsx`. Replace everything from `return (` to the end of the function (lines 162–179) with:

```tsx
  return (
    <div className="flex flex-row h-[calc(100vh-57px)]">
      {/* Profile sidebar */}
      <div className="w-[280px] shrink-0 border-r overflow-hidden">
        <ProfilePanel profile={profile} onUpdate={setProfile} />
      </div>

      {/* Chat column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-6">
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
        <div className="px-4 pb-4">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  )
```

- [ ] **Step 2: Start dev server and verify layout**

```bash
pnpm dev
```

Open `http://localhost:3000`. Start a chat session. Confirm:
- Left sidebar (~280px) renders with "Profile Panel placeholder" (will be implemented next)
- Chat column takes remaining width
- No horizontal overflow or layout shifts
- Messages still scroll and stream correctly

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/ChatInterface.tsx
git commit -m "feat: restructure ChatInterface to two-column layout with profile sidebar"
```

---

## Task 4: Rewrite ProfilePanel as editable form

**Files:**
- Modify: `src/components/panels/ProfilePanel.tsx` (full rewrite)

- [ ] **Step 1: Write the failing tests for `isDirty`**

Add to `tests/components/profile-panel.test.ts` (append after existing describe blocks):

```ts
import { isDirty } from '@/components/panels/ProfilePanel'

describe('isDirty', () => {
  const base = { grade: 10, state: 'CA', gpa: 3.5, interests: ['business'], goals: ['transfer'] }

  it('returns false when draft matches profile', () => {
    expect(isDirty({ ...base }, { ...base })).toBe(false)
  })

  it('returns true when grade differs', () => {
    expect(isDirty({ ...base, grade: 11 }, base)).toBe(true)
  })

  it('returns true when state differs', () => {
    expect(isDirty({ ...base, state: 'TX' }, base)).toBe(true)
  })

  it('returns true when gpa differs', () => {
    expect(isDirty({ ...base, gpa: 4.0 }, base)).toBe(true)
  })

  it('returns true when interests differ', () => {
    expect(isDirty({ ...base, interests: ['nursing'] }, base)).toBe(true)
  })

  it('returns true when goals differ', () => {
    expect(isDirty({ ...base, goals: [] }, base)).toBe(true)
  })

  it('returns false for null fields when both null', () => {
    expect(isDirty({ grade: null, state: null, gpa: null, interests: [], goals: [] },
                   { grade: null, state: null, gpa: null, interests: [], goals: [] })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/components/profile-panel.test.ts
```

Expected: FAIL — `isDirty is not a function`.

- [ ] **Step 3: Rewrite ProfilePanel.tsx**

Replace the entire contents of `src/components/panels/ProfilePanel.tsx` with:

```tsx
'use client'
// src/components/panels/ProfilePanel.tsx
import { useState, useEffect } from 'react'
import type { StudentProfile } from '@/lib/types'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const GRADE_OPTIONS = [
  { value: 9,  label: '9th Grade' },
  { value: 10, label: '10th Grade' },
  { value: 11, label: '11th Grade' },
  { value: 12, label: '12th Grade' },
  { value: 13, label: 'Graduated / GED' },
  { value: 14, label: 'Adult Learner' },
]

type DraftShape = Pick<StudentProfile, 'grade' | 'state' | 'gpa' | 'interests' | 'goals'>

export function isDirty(draft: DraftShape, profile: DraftShape): boolean {
  return (
    draft.grade !== profile.grade ||
    draft.state !== profile.state ||
    draft.gpa !== profile.gpa ||
    JSON.stringify(draft.interests) !== JSON.stringify(profile.interests) ||
    JSON.stringify(draft.goals) !== JSON.stringify(profile.goals)
  )
}

interface ProfilePanelProps {
  profile: StudentProfile
  onUpdate: (updated: StudentProfile) => void
}

export function ProfilePanel({ profile, onUpdate }: ProfilePanelProps) {
  const [draft, setDraft] = useState<StudentProfile>(profile)
  const [interestInput, setInterestInput] = useState('')
  const [goalInput, setGoalInput] = useState('')

  useEffect(() => {
    setDraft(profile)
    setInterestInput('')
    setGoalInput('')
  }, [profile])

  function addTag(field: 'interests' | 'goals', value: string) {
    const trimmed = value.trim().replace(/,$/, '')
    if (!trimmed) return
    setDraft((d) => ({ ...d, [field]: [...new Set([...d[field], trimmed])] }))
    if (field === 'interests') setInterestInput('')
    else setGoalInput('')
  }

  function removeTag(field: 'interests' | 'goals', value: string) {
    setDraft((d) => ({ ...d, [field]: d[field].filter((v) => v !== value) }))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
          Your Profile
        </h3>

        {/* Grade */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Grade</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={draft.grade ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, grade: e.target.value ? Number(e.target.value) : null }))
            }
          >
            <option value="">Select grade</option>
            {GRADE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* State */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">State</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={draft.state ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, state: e.target.value || null }))
            }
          >
            <option value="">Select state</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* GPA */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">GPA</label>
          <input
            type="number"
            min={0}
            max={4.0}
            step={0.1}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            value={draft.gpa ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, gpa: e.target.value ? Number(e.target.value) : null }))
            }
            placeholder="e.g. 3.5"
          />
        </div>

        {/* Interests */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Interests</label>
          <div className="flex gap-1">
            <input
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
              placeholder="Add interest…"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag('interests', interestInput)
                }
              }}
            />
            <button
              type="button"
              className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted"
              onClick={() => addTag('interests', interestInput)}
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {draft.interests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {interest}
                <button
                  type="button"
                  onClick={() => removeTag('interests', interest)}
                  className="text-muted-foreground hover:text-foreground leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Goals</label>
          <div className="flex gap-1">
            <input
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
              placeholder="Add goal…"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag('goals', goalInput)
                }
              }}
            />
            <button
              type="button"
              className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted"
              onClick={() => addTag('goals', goalInput)}
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {draft.goals.map((goal) => (
              <span
                key={goal}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {goal}
                <button
                  type="button"
                  onClick={() => removeTag('goals', goal)}
                  className="text-muted-foreground hover:text-foreground leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Update button */}
      <div className="p-4 border-t shrink-0">
        <button
          type="button"
          className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!isDirty(draft, profile)}
          onClick={() => onUpdate(draft)}
        >
          Update Profile
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: all tests PASS (mergeProfile × 4, setStudentProfile × 3, isDirty × 7).

- [ ] **Step 5: Verify in the browser**

```bash
pnpm dev
```

Open `http://localhost:3000`. Pick a persona (e.g., Mateo). Confirm:
1. Profile sidebar shows on the left with Mateo's data pre-filled (Grade: 10th, State: CA, Interests: business, entrepreneurship, Goals: bachelor's degree in business, transfer from community college)
2. Editing any field enables the **Update Profile** button
3. Clicking **Update Profile** disables the button again (draft now matches profile)
4. Sending a message after updating — verify the AI's response reflects the new profile context
5. Starting without a persona — sidebar shows empty selects and no tags

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/ProfilePanel.tsx tests/components/profile-panel.test.ts
git commit -m "feat: rewrite ProfilePanel as editable form with draft state and Update button"
```

---

## Done

At this point:
- All 14 tests pass
- Profile sidebar is visible alongside chat
- Pre-fills from persona's `initialProfile`
- User can edit grade, state, GPA, interests, goals and click **Update Profile**
- Each chat message includes the current profile so the AI has live context

Run the full test suite one final time:

```bash
pnpm test
```

Expected output: 14 tests, 0 failures.
