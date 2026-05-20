# Demo Walkthrough

## Setup

```bash
pnpm install
pnpm seed:demo
SQLITE_PATH=./data/pathwayai.demo.db pnpm dev
```

The seed script prints the demo identifiers — note the **Student A id** and the **mom id** from the output; you'll need them for the parent-side flow.

## Storyboard (10 minutes)

### 1. Student arrives (2 min)
- Land on `/`. Pick **"I'm a student"** → from the **Continue as** list, pick **Maria**.
- The workspace loads with the seeded conversation visible in the left rail. Profile is pre-filled in the right rail.
- Send: *"I'm worried I can't afford college."* — the assistant picks up the anxious tone signal (see "How we got here") and answers warmly with one concrete step.

### 2. Inline editable workspace (2 min)
- Open the right rail. Edit family income to $35k → click **Update**.
- Ask: *"Compare BMCC and Pace for me on cost."*
- A comparison table appears in the workbench. Below it, the assistant emits a `financial_aid_view` — drag the family-income slider, watch projected net price recompute.

### 3. Share with a parent (2 min)
- Click **Share with parent / counselor** in the left rail.
- Choose **Parent / guardian**, 7 days → **Generate link** → **Copy link**.
- Open the link in an incognito window. Fill in "Maria's dad" as the adult name → **Accept invitation**.
- You land in the **adult workspace** with pinned context up top: phase, interests, goals, recent questions.
- Adult asks: *"What questions should I be asking her right now?"* — adult-scoped system prompt produces parent-coaching answers, never speaking to the student directly.

### 4. Counselor flow (1 min)
- Open Student B (Jamal) via a separate share (already seeded with **Ms. Patel** as counselor).
- Go to `/adult/<counselor-id>/student/<jamal-id>`.
- Same surface, but the system prompt shifts to clinical/professional tone (driven by `adults.kind = 'counselor'`).

### 5. Drafts (1 min)
- Back in Maria's workspace, ask: *"Can you start a FAFSA draft for me?"*
- A `fafsa_draft` component renders. Edit a field → click **Export** → markdown file downloads.
- The amber disclosure ("Pathway does not submit anything on your behalf") is visible at the top and bottom.

### 6. Memory portability (1 min)
- Click **Export my memory** in the left rail → JSON downloads.
- Switch role (logo / "Switch role" in left rail). On `/`, click **…or restore from a previous export**.
- Upload the JSON. You land in `/student/<new-id>` with all conversations, profile, and components intact.

### 7. Trust layer (1 min)
- Pick any assistant turn. The **How we got here** panel in the right rail lists intent + signals + sources.
- Citations appear as a small footnote count below the assistant message.

## Talking points for the deck

- **Memory & portability:** durable per-student state, export/import, multi-adult shareable. Solves "taking memory with them" and "granting access to caring adults" from the post-demo feedback email.
- **Engagement / sequencing:** workbench panels replace prose dumps. Decision matrices, financial-aid sliders, drafts.
- **Adaptive UX:** tone classification per turn (Haiku), readiness/load/deadline signals shape the system prompt.
- **Trust:** Opus rubric judge runs on assistant turns asynchronously; advisor-rubric badges surface when ≥0.7.
- **Agentic posture:** drafts, never submits — every draft surface carries explicit disclosure.
- **Family/counselor:** dedicated adult surface with role-scoped prompts (parent vs counselor) — addresses the email's "expose recs to contact with other people."
