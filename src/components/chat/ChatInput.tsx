'use client'
// src/components/chat/ChatInput.tsx
import { useEffect, useState, useRef, KeyboardEvent } from 'react'
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

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-border/60 bg-white p-1.5 shadow-lg shadow-black/[0.03] transition-shadow focus-within:shadow-xl focus-within:shadow-black/[0.06] focus-within:border-[#1a6b5a]/20">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your future..."
            disabled={disabled}
            rows={1}
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
              canSend
                ? 'bg-[#1a6b5a] text-white shadow-sm hover:bg-[#155a4b] active:scale-95'
                : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
            }`}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="text-center mt-2 text-[11px] text-muted-foreground/50">
        Press Enter to send · Shift+Enter for a new line
      </p>
    </div>
  )
}
