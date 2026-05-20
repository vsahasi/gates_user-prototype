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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="rounded-xl bg-[#f5f5f2] border border-border/60 p-4 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {student.displayName}&apos;s pinned context
        </div>
        <div>
          <b>Phase:</b> {summary.currentPhase ?? 'just getting started'}
        </div>
        {summary.interests.length > 0 && (
          <div>
            <b>Interests:</b> {summary.interests.join(', ')}
          </div>
        )}
        {summary.goals.length > 0 && (
          <div>
            <b>Goals:</b> {summary.goals.join(', ')}
          </div>
        )}
        {summary.openQuestions.length > 0 && (
          <div>
            <b>Recent questions:</b>
            <ul className="list-disc pl-4 text-sm">
              {summary.openQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="text-xs text-muted-foreground italic">{summary.summary}</div>
      </div>

      <div className="space-y-1">
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator />}
      </div>

      <ChatInput onSend={send} disabled={isLoading} />
    </div>
  )
}
