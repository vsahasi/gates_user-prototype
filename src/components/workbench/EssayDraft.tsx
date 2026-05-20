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
  return (
    <div className="rounded-xl border border-border/60 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Personal statement draft</h4>
        <button
          onClick={download}
          className="text-xs text-[#1a6b5a] hover:underline flex items-center gap-1"
        >
          <Download className="h-3 w-3" /> Export
        </button>
      </div>
      <div className="text-xs text-muted-foreground italic">Prompt: {initial.prompt}</div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full min-h-[260px] p-3 rounded-lg border border-border/60 text-sm leading-relaxed"
      />
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
        {[
          'Tighten this paragraph',
          'Show me three angles',
          'Make this more personal',
          'Check for clichés',
        ].map((p) => (
          <button
            key={p}
            onClick={() => onPrompt?.(`${p}: ${draft.slice(0, 1000)}`)}
            className="text-xs px-2.5 py-1 rounded-full bg-[#1a6b5a]/5 border border-[#1a6b5a]/20 text-[#1a6b5a] hover:bg-[#1a6b5a]/10"
          >
            {p}
          </button>
        ))}
      </div>
      <p className="text-[11px] rounded bg-amber-50 border border-amber-200 px-2 py-1.5 text-amber-900">
        Draft only — PathwayAI does not submit to any college on your behalf.
      </p>
    </div>
  )
}
