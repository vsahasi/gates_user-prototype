# Profile Collection Panel — Design Spec

**Date:** 2026-04-15

---

## Overview

Add an always-visible sidebar panel to the chat interface where students can view and edit their profile. The panel pre-fills from the selected persona's `initialProfile` and gives the AI live context on the student's grade, state, GPA, interests, and goals.

---

## Section 1: Data Flow

- `ChatPage` (`/app/chat/[sessionId]/page.tsx`) already resolves the full `Persona` object from `personaId`. It will pass a new `initialProfile: Partial<StudentProfile>` prop to `ChatInterface`.
- Inside `ChatInterface`, a `profile` state is initialized by merging `initialProfile` over a blank `StudentProfile` default.
- Each call to `/api/chat` includes the current `profile` in the request body so the AI has live context.
- The panel manages a local `draft` copy of the profile. Clicking **Update** commits `draft → profile`, which flows to the next message sent.
- When the persona changes (i.e., a new `initialProfile` is received), the profile state resets to the new persona's data.

---

## Section 2: Layout Restructure

`ChatInterface` outer wrapper changes from `flex flex-col` to `flex flex-row h-[calc(100vh-57px)]`.

```
┌─────────────────────┬──────────────────────────────────┐
│  Profile sidebar    │  Chat column                     │
│  ~280px, fixed      │  flex-1, messages + input        │
│  overflow-y-auto    │  overflow-y-auto                 │
└─────────────────────┴──────────────────────────────────┘
```

- The sidebar column: `w-[280px] shrink-0 border-r overflow-y-auto p-4`
- The chat column: `flex-1 flex flex-col overflow-hidden` — preserves existing scroll and input structure; removes the `max-w-3xl mx-auto` centering (no longer needed since chat isn't full-viewport-width)

---

## Section 3: EditableProfilePanel Component

**File:** `src/components/panels/ProfilePanel.tsx` (rewritten in place)

**Props:**
```ts
interface ProfilePanelProps {
  profile: StudentProfile
  onUpdate: (updated: StudentProfile) => void
}
```

**Internal state:** `draft: StudentProfile` — initialized from `profile` prop, reset when `profile` changes (via `useEffect`).

**Fields:**
| Field | Input type | Notes |
|-------|-----------|-------|
| Grade | `<select>` | Options: 9, 10, 11, 12, "Graduated/GED", "Adult learner" |
| State | `<select>` | All 50 US state abbreviations + DC |
| GPA | `<input type="number">` | Range 0–4.0, step 0.1 |
| Interests | Tag chips | Text input + Enter/comma to add; × button to remove |
| Goals | Tag chips | Same pattern as interests |

**Update button:**
- Disabled when `draft` equals current `profile` (deep compare on the five editable fields)
- On click: calls `onUpdate(draft)`, which sets profile state in ChatInterface
- Label: "Update Profile"

**Header:** "Your Profile" label, no close/collapse button (always visible).

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/chat/[sessionId]/page.tsx` | Add `initialProfile={persona?.initialProfile}` prop to `<ChatInterface>` |
| `src/components/chat/ChatInterface.tsx` | Add `initialProfile` prop, `profile` state, two-column layout, render `<ProfilePanel>` in sidebar, pass `profile` to `/api/chat` |
| `src/components/panels/ProfilePanel.tsx` | Rewrite as editable panel with draft state and Update button |
| `src/lib/types.ts` | No changes needed — `StudentProfile` already has all required fields |

---

## Out of Scope

- Mobile responsiveness (separate pass)
- Collapsing/hiding the sidebar
- Financial info, constraints, special circumstances fields (core+academic fields only per user decision)
- Persisting profile across sessions (in-memory only for now)
