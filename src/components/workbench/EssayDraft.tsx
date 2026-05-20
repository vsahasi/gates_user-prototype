// src/components/workbench/EssayDraft.tsx
'use client'
import { useState } from 'react'
import type { EssayDraftData } from '@/lib/types'
import { Download } from 'lucide-react'

interface Props {
  data: EssayDraftData
  onPrompt?: (prompt: string) => void
}

export function EssayDraft({ data: initial, onPrompt }: Props) {
  const [draft, setDraft] = useState(initial.draft)
  function download() {
    const md = `# ${initial.prompt}\n\n${draft}`
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'essay-draft.md'
    a.click()
    URL.revokeObjectURL(url)
  }
  const wordCount = draft.trim().split(/\s+/).filter(Boolean).length

  return (
    <figure className="almanac-card animate-slide-up">
      <figcaption className="px-5 pt-4 pb-3 border-b border-rule flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow-accent">Draft · Personal statement</div>
          <p className="font-display italic text-[13.5px] text-ink-mid mt-1 leading-snug">
            “{initial.prompt}”
          </p>
        </div>
        <button
          onClick={download}
          className="pen-underline text-[12px] text-forest flex items-center gap-1 shrink-0"
        >
          <Download className="h-3 w-3" /> Export
        </button>
      </figcaption>

      <div className="px-5 py-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full min-h-[300px] p-4 bg-paper-warm/40 border border-rule rounded-sm text-[15px] leading-[1.7] font-display text-ink focus:outline-none focus:border-forest focus:bg-card transition-colors"
          placeholder="Start writing. Even a rough first line is a beginning."
        />
        <div className="flex items-center justify-between mt-2">
          <span className="font-mono text-[10.5px] text-ink-faint uppercase tracking-wider">
            {wordCount} word{wordCount === 1 ? '' : 's'}
          </span>
          <span className="font-display italic text-[11px] text-ink-soft">
            Common App range: 250–650
          </span>
        </div>
      </div>

      <div className="px-5 pb-4 border-t border-rule pt-3">
        <div className="caps-sm mb-2">Ask the advisor</div>
        <div className="flex flex-wrap gap-1.5">
          {[
            'Tighten this paragraph',
            'Show me three angles',
            'Make this more personal',
            'Check for clichés',
          ].map((p) => (
            <button
              key={p}
              onClick={() => onPrompt?.(`${p}: ${draft.slice(0, 1000)}`)}
              className="text-[12px] px-2.5 py-1 rounded-sm border border-rule bg-card text-ink-mid hover:border-forest hover:text-forest hover:bg-forest-soft transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-5 mb-4 px-3 py-2 border-l-2 border-rust bg-rust-soft text-[12px] text-rust leading-relaxed">
        <span className="font-display italic font-semibold">A note —</span> this is a draft.
        PathwayAI does not submit to any college on your behalf.
      </div>
    </figure>
  )
}
