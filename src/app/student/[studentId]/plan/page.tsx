// src/app/student/[studentId]/plan/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { buildStudentPlan } from '@/lib/orchestration/plan'
import { getStudent } from '@/lib/db/queries'
import { runMigrations } from '@/lib/db'
import type { Phase, PlanSelectionGroup, PlanDraft, PlanQuestion, PlanConversationIndex } from '@/lib/orchestration/plan'

// ─── Helpers ────────────────────────────────────────────────────────────────

const PHASES: { id: Phase; label: string; roman: string }[] = [
  { id: 'exploration',  label: 'Exploration',  roman: 'I'   },
  { id: 'preparation',  label: 'Preparation',  roman: 'II'  },
  { id: 'decision',     label: 'Decision',     roman: 'III' },
  { id: 'application',  label: 'Application',  roman: 'IV'  },
  { id: 'transition',   label: 'Transition',   roman: 'V'   },
]

function relativeTime(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60)    return 'just now'
  if (sec < 3600)  return `${Math.floor(sec / 60)} min ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`
  const d = Math.floor(sec / 86400)
  if (d === 1)     return 'yesterday'
  if (d < 30)      return `${d} days ago`
  if (d < 365)     return `${Math.floor(d / 30)} mo ago`
  return `${Math.floor(d / 365)} yr ago`
}

function stanceChip(stance: 'considering' | 'leaning' | 'committed') {
  if (stance === 'committed') {
    return (
      <span className="inline-block font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 bg-forest text-white rounded-[3px]">
        committed
      </span>
    )
  }
  if (stance === 'leaning') {
    return (
      <span className="inline-block font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 bg-forest-soft text-forest border border-forest/20 rounded-[3px]">
        leaning
      </span>
    )
  }
  return (
    <span className="inline-block font-mono text-[10px] tracking-widest uppercase px-1.5 py-0.5 bg-paper-warm text-ink-soft border border-rule rounded-[3px]">
      considering
    </span>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PhaseTrack({
  currentPhase,
  phaseProgress,
}: {
  currentPhase: Phase
  phaseProgress: number
}) {
  const currentIdx = PHASES.findIndex((p) => p.id === currentPhase)
  return (
    <div>
      <div className="flex gap-0 border border-rule-strong overflow-hidden rounded-[4px]">
        {PHASES.map((p, i) => {
          const isPast    = i < currentIdx
          const isCurrent = i === currentIdx
          const isFuture  = i > currentIdx
          return (
            <div
              key={p.id}
              className={`flex-1 relative px-3 py-3 border-r border-rule last:border-r-0 ${
                isCurrent
                  ? 'bg-forest'
                  : isPast
                  ? 'bg-forest-soft'
                  : 'bg-paper-warm'
              }`}
            >
              <div
                className={`font-mono text-[11px] font-medium tracking-[0.08em] ${
                  isCurrent ? 'text-white/70' : isPast ? 'text-forest/60' : 'text-ink-faint'
                }`}
              >
                {p.roman}
              </div>
              <div
                className={`font-display text-[12.5px] mt-0.5 leading-tight ${
                  isCurrent ? 'text-white font-medium' : isPast ? 'text-forest' : 'text-ink-faint'
                }`}
              >
                {p.label}
              </div>
              {isCurrent && (
                <div className="absolute bottom-0 left-0 h-[3px] bg-white/30 w-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.round(phaseProgress * 100)}%` }}
                  />
                </div>
              )}
              {isFuture && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-px bg-rule opacity-40" />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="font-display italic text-[15px] text-ink-mid mt-3">
        You are in the{' '}
        <span className="text-forest font-medium not-italic">{currentPhase}</span> phase.
      </p>
    </div>
  )
}

function SelectionsSection({
  studentId,
  groups,
}: {
  studentId: string
  groups: PlanSelectionGroup[]
}) {
  if (groups.length === 0) {
    return (
      <p className="font-display italic text-[15px] text-ink-soft leading-relaxed">
        No choices marked yet. As you compare options, tap them to add them here.
      </p>
    )
  }
  return (
    <div className="space-y-8 stagger">
      {groups.map((group) => (
        <div key={group.kind}>
          <div className="eyebrow mb-3">
            {group.kind.charAt(0).toUpperCase() + group.kind.slice(1)}s you&rsquo;re considering
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {group.items.map((item) => (
              <div key={item.id} className="almanac-card p-3 flex flex-col gap-1.5">
                <div className="font-display text-[18px] leading-tight text-ink">
                  {item.refLabel}
                </div>
                <div>{stanceChip(item.stance)}</div>
                {item.note && (
                  <p className="text-[12.5px] italic text-ink-soft leading-snug mt-0.5">
                    {item.note}
                  </p>
                )}
                <div className="font-mono text-[10.5px] text-ink-faint mt-auto pt-1">
                  {relativeTime(item.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function DraftsSection({
  studentId,
  drafts,
}: {
  studentId: string
  drafts: PlanDraft[]
}) {
  if (drafts.length === 0) {
    return (
      <p className="font-display italic text-[15px] text-ink-soft leading-relaxed">
        No drafts started yet.
      </p>
    )
  }
  return (
    <div className="space-y-3 stagger">
      {drafts.map((draft, i) => (
        <div key={`${draft.conversationId}-${i}`} className="almanac-card p-4">
          <div className="eyebrow mb-1">
            {draft.kind === 'essay_draft' ? 'Essay draft' : 'FAFSA draft'}
          </div>
          <div className="font-display text-[18px] leading-tight text-ink mb-2">
            {draft.conversationTitle}
          </div>
          {draft.preview && (
            <p
              className={`text-[14px] text-ink-mid leading-relaxed mb-3 ${
                draft.kind === 'fafsa_draft' ? 'italic text-ink-soft' : ''
              }`}
            >
              {draft.kind === 'essay_draft'
                ? draft.preview + (draft.preview.length >= 120 ? '…' : '')
                : draft.preview}
            </p>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-rule">
            <span className="font-mono text-[10.5px] text-ink-faint">
              {relativeTime(draft.updatedAt)}
            </span>
            <Link
              href={`/student/${studentId}/${draft.conversationId}`}
              className="font-display italic text-[13.5px] text-forest pen-underline"
            >
              Continue &rarr;
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}

function QuestionsSection({
  studentId,
  questions,
}: {
  studentId: string
  questions: PlanQuestion[]
}) {
  if (questions.length === 0) {
    return (
      <p className="font-display italic text-[15px] text-ink-soft leading-relaxed">
        Nothing outstanding right now.
      </p>
    )
  }
  return (
    <ul className="space-y-2 stagger">
      {questions.map((q, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="font-display italic text-forest text-[16px] leading-none mt-0.5 shrink-0">
            ›
          </span>
          <Link
            href={`/student/${studentId}/${q.conversationId}`}
            className="font-display italic text-[15px] text-ink-mid leading-snug pen-underline hover:text-ink"
          >
            {q.text}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function ConversationsSection({
  studentId,
  conversations,
}: {
  studentId: string
  conversations: PlanConversationIndex[]
}) {
  if (conversations.length === 0) {
    return (
      <p className="font-display italic text-[15px] text-ink-soft leading-relaxed">
        No conversations yet.
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 stagger">
      {conversations.map((conv) => (
        <Link
          key={conv.id}
          href={`/student/${studentId}/${conv.id}`}
          className="almanac-card px-3.5 py-2.5 flex items-baseline justify-between gap-3 hover:border-rule-strong transition-colors group"
        >
          <span className="font-display text-[14px] text-ink truncate group-hover:text-forest transition-colors">
            {conv.title}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-[10px] text-ink-faint">
              {conv.messageCount} msg
            </span>
            <span className="font-mono text-[10px] text-ink-faint">
              {relativeTime(conv.lastMessageAt)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  eyebrow,
  heading,
  children,
}: {
  eyebrow: string
  heading: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="eyebrow-accent mb-1">{eyebrow}</div>
      <h2 className="font-display text-[28px] text-ink leading-tight mb-4">{heading}</h2>
      <hr className="rule-h mb-5" />
      {children}
    </section>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function StudentPlanPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  await runMigrations()
  const { studentId } = await params
  const student = await getStudent(studentId)
  if (!student) redirect('/')
  const plan = await buildStudentPlan(studentId)
  if (!plan) redirect('/')

  const lastActivity = plan.lastActivityAt ? relativeTime(plan.lastActivityAt) : null

  return (
    <div className="min-h-screen bg-paper">
      <Header personaName={student.displayName} />
      <main className="mx-auto max-w-[860px] px-6 py-12 animate-fade-in">
        {/* ── Page header ────────────────────────────────────────── */}
        <div className="mb-12">
          <div className="eyebrow-accent mb-2">A study companion · MY PLAN</div>
          <h1 className="font-display text-[44px] leading-[1.1] text-ink tracking-tight mb-3">
            {plan.studentName}&rsquo;s next steps
          </h1>
          <p className="font-display italic text-[15px] text-ink-mid">
            {lastActivity
              ? `Last active ${lastActivity} · `
              : null}
            <span className="font-mono not-italic text-[13px]">
              {plan.totalMessages}
            </span>{' '}
            messages across{' '}
            <span className="font-mono not-italic text-[13px]">
              {plan.conversationCount}
            </span>{' '}
            conversation{plan.conversationCount !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="space-y-14 stagger">
          {/* ── Phase track ──────────────────────────────────────── */}
          <Section eyebrow="Progress" heading="Where I am">
            <PhaseTrack
              currentPhase={plan.currentPhase}
              phaseProgress={plan.phaseProgress}
            />
          </Section>

          {/* ── Selections ───────────────────────────────────────── */}
          <Section eyebrow="Choices" heading="My choices">
            <SelectionsSection studentId={studentId} groups={plan.selections} />
          </Section>

          {/* ── Drafts ───────────────────────────────────────────── */}
          <Section eyebrow="Work in progress" heading="In progress">
            <DraftsSection studentId={studentId} drafts={plan.drafts} />
          </Section>

          {/* ── Open questions ───────────────────────────────────── */}
          <Section eyebrow="Questions" heading="Open questions">
            <QuestionsSection studentId={studentId} questions={plan.openQuestions} />
          </Section>

          {/* ── Conversations ────────────────────────────────────── */}
          <Section eyebrow="History" heading="Conversations">
            <ConversationsSection
              studentId={studentId}
              conversations={plan.conversations}
            />
          </Section>
        </div>

        {/* ── Trailing rule ────────────────────────────────────────── */}
        <div className="mt-16 mb-4">
          <div className="rule-fancy">
            <span className="ornament text-[14px]">✦</span>
          </div>
          {lastActivity && (
            <p className="text-center font-mono text-[11px] text-ink-faint mt-3 tracking-widest uppercase">
              Last reviewed {lastActivity}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
