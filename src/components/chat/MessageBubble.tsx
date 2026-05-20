'use client'
// src/components/chat/MessageBubble.tsx
import type { Message } from '@/lib/types'
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
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function MessageBubble({
  message,
  structuredComponent,
  citations,
  rubricOverall,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="mb-6 flex justify-end animate-message-in">
        <div className="max-w-[78%] flex flex-col items-end gap-1.5">
          <div className="bubble-user whitespace-pre-wrap text-[14.5px] leading-[1.55]">
            {message.content}
          </div>
          <span className="font-mono text-[10.5px] text-ink-faint">
            {formatRelativeTime(message.timestamp)} ago
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-7 flex gap-4 animate-message-in">
      <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
        <div className="h-9 w-9 rounded-full border border-rule bg-card flex items-center justify-center font-display italic text-[16px] text-forest">
          §
        </div>
        <div className="w-px flex-1 bg-rule" />
      </div>

      <div className="flex-1 min-w-0 max-w-[calc(100%-3.25rem)]">
        <div className="flex items-baseline gap-3 mb-1.5">
          <span className="font-display text-[14px] text-ink-mid">The advisor</span>
          <span className="font-mono text-[10.5px] text-ink-faint">
            {formatRelativeTime(message.timestamp)} ago
          </span>
          {rubricOverall != null && <AdvisorBadge score={rubricOverall} />}
        </div>

        <div className="bubble-assistant text-[15px] leading-[1.65] text-ink prose-pathway">
          {message.content && <AssistantMarkdown content={message.content} />}
        </div>

        {structuredComponent && (
          <div className="mt-3 animate-slide-up">{structuredComponent}</div>
        )}

        {citations && citations.length > 0 && <CitationFootnotes citations={citations} />}
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="mb-7 flex gap-4 animate-message-in">
      <div className="shrink-0 pt-1">
        <div className="h-9 w-9 rounded-full border border-rule bg-card flex items-center justify-center font-display italic text-[16px] text-forest">
          §
        </div>
      </div>
      <div className="flex-1">
        <div className="font-display text-[14px] text-ink-mid mb-1.5">The advisor</div>
        <div className="bubble-assistant inline-flex items-center gap-2 py-3">
          <span className="typing-dot h-1.5 w-1.5 rounded-full" />
          <span className="typing-dot h-1.5 w-1.5 rounded-full" />
          <span className="typing-dot h-1.5 w-1.5 rounded-full" />
          <span className="eyebrow ml-2">composing</span>
        </div>
      </div>
    </div>
  )
}
