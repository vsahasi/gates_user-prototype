'use client'
// src/components/chat/MessageBubble.tsx
import type { Message } from '@/lib/types'
import { Compass, User } from 'lucide-react'
import { AssistantMarkdown } from '@/components/chat/AssistantMarkdown'
import { CitationFootnotes } from '@/components/trust/CitationChip'
import { AdvisorBadge } from '@/components/trust/AdvisorBadge'

interface MessageBubbleProps {
  message: Message
  structuredComponent?: React.ReactNode
  citations?: Array<{ index: number; source: string }>
  rubricOverall?: number | null
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function MessageBubble({
  message,
  structuredComponent,
  citations,
  rubricOverall,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`mb-5 flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1a6b5a] to-[#2d8a73] shadow-sm">
          <Compass className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={`flex max-w-[80%] flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
            isUser
              ? 'rounded-br-lg bg-[#1a6b5a] text-white shadow-sm shadow-[#1a6b5a]/15 [&_a]:text-white [&_a]:underline'
              : 'rounded-bl-lg bg-white text-foreground shadow-sm border border-border/40'
          } ${isUser ? 'whitespace-pre-wrap' : ''}`}
        >
          {isUser ? (
            message.content
          ) : message.content ? (
            <AssistantMarkdown content={message.content} />
          ) : null}
        </div>
        {structuredComponent && (
          <div className="w-full animate-slide-up">
            {structuredComponent}
          </div>
        )}
        {!isUser && citations && citations.length > 0 && (
          <CitationFootnotes citations={citations} />
        )}
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] text-muted-foreground/60 select-none">
            {formatRelativeTime(message.timestamp)}
          </span>
          {!isUser && rubricOverall != null && <AdvisorBadge score={rubricOverall} />}
        </div>
      </div>
      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1a6b5a]/10 text-[#1a6b5a]">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="mb-5 flex justify-start gap-3 animate-message-in">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1a6b5a] to-[#2d8a73] shadow-sm">
        <Compass className="h-4 w-4 text-white" />
      </div>
      <div className="rounded-2xl rounded-bl-lg bg-white border border-border/40 px-5 py-4 shadow-sm">
        <div className="flex h-4 items-center gap-1.5">
          <span className="typing-dot h-2 w-2 rounded-full bg-[#1a6b5a]/40" />
          <span className="typing-dot h-2 w-2 rounded-full bg-[#1a6b5a]/40" />
          <span className="typing-dot h-2 w-2 rounded-full bg-[#1a6b5a]/40" />
        </div>
      </div>
    </div>
  )
}
