// src/components/chat/MessageBubble.tsx
import type { Message } from '@/lib/types'
import { Bot, UserRound } from 'lucide-react'
import { AssistantMarkdown } from '@/components/chat/AssistantMarkdown'

interface MessageBubbleProps {
  message: Message
  structuredComponent?: React.ReactNode
}

export function MessageBubble({ message, structuredComponent }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`mb-4 flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className={`flex max-w-[85%] flex-col space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ring-1 ring-black/5 ${
            isUser
              ? 'rounded-br-md bg-primary text-primary-foreground [&_a]:text-primary-foreground [&_a]:decoration-primary-foreground/60'
              : 'rounded-bl-md bg-card text-foreground'
          } ${isUser ? 'whitespace-pre-wrap' : ''}`}
        >
          {isUser ? (
            message.content
          ) : message.content ? (
            <AssistantMarkdown content={message.content} />
          ) : null}
        </div>
        {structuredComponent && (
          <div className="w-full rounded-2xl border border-border/70 bg-background/70 p-2 backdrop-blur-sm">
            {structuredComponent}
          </div>
        )}
      </div>
      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserRound className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="mb-4 flex justify-start gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-bl-md border border-border/70 bg-card px-4 py-3 shadow-sm">
        <div className="flex h-4 items-center gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
