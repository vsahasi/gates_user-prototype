// src/components/adult/AdultWorkspace.tsx
'use client'
import { useState } from 'react'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageBubble, TypingIndicator } from '@/components/chat/MessageBubble'
import type { Adult, Student, AdultMessage } from '@/lib/db/queries'
import type { PinnedSummary } from '@/lib/orchestration/pinned-summary'

interface Props {
  adult: Adult
  student: Student
  summary: PinnedSummary
  initialMessages?: AdultMessage[]
}

interface Msg {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

function relative(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000)
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

export function AdultWorkspace({ adult, student, summary, initialMessages = [] }: Props) {
  const [messages, setMessages] = useState<Msg[]>(() =>
    initialMessages.map((m) => ({
      role: m.role === 'system' ? 'assistant' : (m.role as 'user' | 'assistant'),
      content: m.content,
      timestamp: m.timestamp,
    })),
  )
  const [isLoading, setLoading] = useState(false)

  async function send(text: string) {
    setMessages((p) => [
      ...p,
      { role: 'user', content: text, timestamp: Date.now() },
      { role: 'assistant', content: '', timestamp: Date.now() },
    ])
    setLoading(true)
    const res = await fetch('/api/adult/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, adultId: adult.id, studentId: student.id }),
    })
    if (!res.ok) {
      const j = await res.json()
      setMessages((p) => {
        const next = [...p]
        next[next.length - 1] = {
          role: 'assistant',
          content: j.error ?? 'Error',
          timestamp: Date.now(),
        }
        return next
      })
      setLoading(false)
      return
    }
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let acc = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      acc += dec.decode(value, { stream: true })
      setMessages((p) => {
        const next = [...p]
        next[next.length - 1] = { role: 'assistant', content: acc, timestamp: Date.now() }
        return next
      })
    }
    setLoading(false)
  }

  const hasAnyContext =
    summary.interests.length > 0 ||
    summary.goals.length > 0 ||
    summary.programInterests.length > 0 ||
    summary.constraints.length > 0 ||
    summary.recentExchanges.length > 0 ||
    summary.conversations.length > 0

  const roleLabel = adult.kind === 'counselor' ? 'counselor' : adult.kind === 'parent' ? 'parent' : 'supporter'

  const suggestedPrompts =
    adult.kind === 'counselor'
      ? [
          `What does ${student.displayName} need from me next?`,
          `Where is ${student.displayName} on track and where are the gaps?`,
          `What should I prep before our next meeting?`,
        ]
      : [
          `What's a good question to ask ${student.displayName} this week?`,
          `How can I help without overstepping?`,
          `What does ${student.displayName} seem most worried about?`,
        ]

  return (
    <div className="max-w-[820px] mx-auto px-6 sm:px-10 py-10 space-y-10">
      {/* Editorial header */}
      <header className="space-y-3">
        <div className="eyebrow-accent">A briefing for {roleLabel === 'supporter' ? 'a caring adult' : `the ${roleLabel}`}</div>
        <h1 className="font-display text-[42px] leading-[1.05] tracking-tight text-ink">
          On <span className="italic font-light text-forest">{student.displayName}</span>
        </h1>
        <p className="text-[14px] text-ink-mid font-display italic">
          You are signed in as {adult.displayName}. {summary.summary}
        </p>
        <hr className="rule-h" />
      </header>

      {/* Pinned context */}
      <section className="space-y-6">
        {!hasAnyContext && (
          <p className="text-[14px] text-ink-mid font-display italic">
            {student.displayName} hasn&apos;t added much yet. Once they start chatting and filling
            in their profile, this page will fill in too.
          </p>
        )}

        {/* Quick facts row */}
        {(summary.grade != null || summary.state) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {summary.grade != null && <Fact label="Grade" value={String(summary.grade)} />}
            {summary.state && <Fact label="State" value={summary.state} />}
            <Fact
              label="Phase"
              value={summary.currentPhase ?? 'Exploration'}
            />
            <Fact
              label="Threads"
              value={String(summary.conversations.length || 0)}
            />
          </div>
        )}

        {summary.interests.length > 0 && (
          <Block title="Interests" eyebrow="What lights them up">
            <div className="flex flex-wrap gap-1.5">
              {summary.interests.map((i) => (
                <span
                  key={i}
                  className="inline-block px-2 py-0.5 rounded-sm border border-forest/20 bg-forest-soft text-forest-deep text-[12px]"
                >
                  {i}
                </span>
              ))}
            </div>
          </Block>
        )}

        {summary.goals.length > 0 && (
          <Block title="Goals" eyebrow="Where they want to land">
            <ul className="space-y-1 text-[14px] text-ink-mid">
              {summary.goals.map((g) => (
                <li key={g} className="flex gap-2">
                  <span className="text-forest font-display italic">›</span>
                  {g}
                </li>
              ))}
            </ul>
          </Block>
        )}

        {summary.constraints.length > 0 && (
          <Block title="Constraints" eyebrow="What's holding the frame">
            <ul className="space-y-1 text-[14px] text-ink-mid">
              {summary.constraints.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="text-rust font-display">·</span>
                  {c}
                </li>
              ))}
            </ul>
          </Block>
        )}

        {summary.recentExchanges.length > 0 && (
          <Block title="Recent exchanges" eyebrow="Their last few words">
            <div className="space-y-4">
              {summary.recentExchanges.map((e, i) => (
                <article key={i} className="border-l-2 border-rule pl-4 space-y-1.5">
                  <div className="eyebrow">
                    {e.conversationTitle} · {relative(e.at)}
                  </div>
                  <p className="text-[14px] leading-relaxed text-ink">
                    <span className="font-display italic text-forest mr-1.5">
                      {student.displayName} —
                    </span>
                    {e.studentTurn}
                  </p>
                  <p className="text-[13.5px] leading-relaxed text-ink-mid">
                    <span className="font-display italic text-ink-soft mr-1.5">Advisor —</span>
                    {e.assistantTurn}
                  </p>
                </article>
              ))}
            </div>
          </Block>
        )}

        {summary.openQuestions.length > 0 && (
          <Block title="Open questions" eyebrow="Threads they're pulling on">
            <ul className="space-y-1.5 text-[14px] text-ink-mid">
              {summary.openQuestions.map((q, i) => (
                <li key={i} className="font-display italic leading-snug">
                  “{q}”
                </li>
              ))}
            </ul>
          </Block>
        )}
      </section>

      {/* Adult chat */}
      <section className="space-y-4 pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="eyebrow-accent">Your turn</div>
            <h2 className="font-display text-[22px] text-ink mt-0.5 leading-tight">
              Ask the assistant
            </h2>
          </div>
          <span className="font-display italic text-[12px] text-ink-soft">
            scoped to {student.displayName}
          </span>
        </div>

        {messages.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 stagger">
            {suggestedPrompts.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={isLoading}
                className="almanac-card text-left px-4 py-3 text-[13.5px] text-ink-mid hover:text-ink hover:border-forest hover:bg-forest-soft transition-all disabled:opacity-50"
              >
                <span className="font-display italic text-forest mr-2">›</span>
                {p}
              </button>
            ))}
          </div>
        )}

        <div>
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <TypingIndicator />
          )}
        </div>

        <ChatInput onSend={send} disabled={isLoading} />
      </section>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-rule-strong pl-3">
      <div className="eyebrow">{label}</div>
      <div className="font-display text-[20px] text-ink-mid mt-0.5">{value}</div>
    </div>
  )
}

function Block({
  title,
  eyebrow,
  children,
}: {
  title: string
  eyebrow: string
  children: React.ReactNode
}) {
  return (
    <section>
      <header className="mb-2">
        <div className="eyebrow">{eyebrow}</div>
        <h3 className="font-display text-[20px] text-ink leading-tight">{title}</h3>
      </header>
      {children}
    </section>
  )
}
