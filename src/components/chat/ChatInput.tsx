'use client'
// src/components/chat/ChatInput.tsx
import { useEffect, useState, useRef, KeyboardEvent } from 'react'

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
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
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
      <div className="relative almanac-card focus-within:border-forest focus-within:shadow-[0_0_0_3px_var(--forest-soft)] transition-shadow">
        <div className="flex items-end gap-2 px-3.5 py-2.5">
          <span className="font-display italic text-[18px] text-forest leading-none pt-3.5 select-none">
            ¶
          </span>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write the question on your mind…"
            disabled={disabled}
            rows={1}
            className="max-h-48 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-ink-faint placeholder:italic placeholder:font-display disabled:cursor-not-allowed text-ink"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`h-9 px-3.5 rounded-sm font-mono text-[12px] uppercase tracking-wider transition-all ${
              canSend
                ? 'bg-ink text-paper hover:bg-black active:scale-95 cursor-pointer'
                : 'bg-paper-warm text-ink-faint cursor-not-allowed'
            }`}
            aria-label="Send"
          >
            Send ↵
          </button>
        </div>
      </div>
      <div className="text-center mt-2 flex items-center justify-center gap-3 text-[10.5px] text-ink-faint">
        <span className="font-mono uppercase tracking-wider">Enter</span>
        <span className="font-display italic">to send</span>
        <span className="ornament">·</span>
        <span className="font-mono uppercase tracking-wider">Shift+Enter</span>
        <span className="font-display italic">for a new line</span>
      </div>
    </div>
  )
}
