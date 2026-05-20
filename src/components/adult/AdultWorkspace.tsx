// src/components/adult/AdultWorkspace.tsx
'use client'
import { useState } from 'react'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageBubble, TypingIndicator } from '@/components/chat/MessageBubble'
import type { Adult, Student } from '@/lib/db/queries'
import type { PinnedSummary } from '@/lib/orchestration/pinned-summary'

interface Props {
  adult: Adult
  student: Student
  summary: PinnedSummary
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

export function AdultWorkspace({ adult, student, summary }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header card */}
      <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-[#1a6b5a]/8 to-transparent border-b border-border/40">
          <div className="text-xs uppercase tracking-wider text-[#1a6b5a] font-semibold">
            {student.displayName}&apos;s pinned context
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            You are signed in as {adult.displayName} ({roleLabel}). {summary.summary}
          </div>
        </div>

        <div className="p-5 space-y-4 text-sm">
          {!hasAnyContext && (
            <p className="text-muted-foreground">
              {student.displayName} hasn&apos;t added much yet. Once they start chatting and filling
              in their profile, you&apos;ll see context here.
            </p>
          )}

          {/* Profile facts */}
          {(summary.grade != null ||
            summary.state ||
            summary.interests.length > 0 ||
            summary.goals.length > 0 ||
            summary.constraints.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {summary.grade != null && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Grade</div>
                  <div>{summary.grade}</div>
                </div>
              )}
              {summary.state && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">State</div>
                  <div>{summary.state}</div>
                </div>
              )}
              {summary.interests.length > 0 && (
                <div className="sm:col-span-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Interests</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {summary.interests.map((i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-[#1a6b5a]/10 text-[#1a6b5a] text-xs">
                        {i}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {summary.goals.length > 0 && (
                <div className="sm:col-span-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Goals</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {summary.goals.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.constraints.length > 0 && (
                <div className="sm:col-span-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Constraints</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {summary.constraints.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Conversation list */}
          {summary.conversations.length > 0 && (
            <div className="pt-3 border-t border-border/40">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Conversations
              </div>
              <div className="space-y-1">
                {summary.conversations.map((c) => (
                  <div key={c.id} className="flex items-baseline gap-2 text-sm">
                    <div className="flex-1 truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.messageCount} msg{c.messageCount === 1 ? '' : 's'} · {relative(c.lastMessageAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent exchanges */}
          {summary.recentExchanges.length > 0 && (
            <div className="pt-3 border-t border-border/40">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Recent exchanges
              </div>
              <div className="space-y-3">
                {summary.recentExchanges.map((e, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="text-xs text-muted-foreground">
                      <span className="italic">{e.conversationTitle}</span> · {relative(e.at)}
                    </div>
                    <div className="rounded-lg bg-[#fafaf8] border border-border/40 px-3 py-2 text-sm">
                      <span className="text-[#1a6b5a] font-medium">{student.displayName}:</span>{' '}
                      {e.studentTurn}
                    </div>
                    <div className="rounded-lg bg-white border border-border/40 px-3 py-2 text-sm">
                      <span className="text-muted-foreground font-medium">Advisor:</span>{' '}
                      {e.assistantTurn}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open questions */}
          {summary.openQuestions.length > 0 && (
            <div className="pt-3 border-t border-border/40">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Open questions
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-sm">
                {summary.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Adult chat */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Ask the assistant
        </div>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestedPrompts.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={isLoading}
                className="text-[13px] px-3 py-1.5 rounded-full border border-[#1a6b5a]/20 bg-white text-[#1a6b5a] hover:bg-[#1a6b5a]/5 disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-1">
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator />}
        </div>
        <div className="mt-3">
          <ChatInput onSend={send} disabled={isLoading} />
        </div>
      </div>
    </div>
  )
}
