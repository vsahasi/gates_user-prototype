'use client'
// src/components/chat/ChatInput.tsx
import { useEffect, useState, useRef, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowUp } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-3xl border border-border/70 bg-background/95 p-2 shadow-lg shadow-black/5 backdrop-blur">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about college, careers, financial aid, or next steps..."
            disabled={disabled}
            rows={1}
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          <Button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            size="icon"
            className="h-10 w-10 rounded-2xl shadow-sm"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
        <p className="px-3 pt-1 text-[11px] text-muted-foreground">Press Enter to send and Shift+Enter for a new line.</p>
      </div>
    </div>
  )
}
