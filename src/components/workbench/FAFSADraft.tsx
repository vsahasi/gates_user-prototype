// src/components/workbench/FAFSADraft.tsx
'use client'
import { useState } from 'react'
import type { FAFSADraftData } from '@/lib/types'
import { Download } from 'lucide-react'

interface Props {
  data: FAFSADraftData
  onAskExplain?: (fieldId: string) => void
}

export function FAFSADraft({ data: initial, onAskExplain }: Props) {
  const [data, setData] = useState(initial)
  function setField(sectionId: string, fieldId: string, value: string) {
    setData({
      ...data,
      sections: data.sections.map((s) =>
        s.id !== sectionId
          ? s
          : { ...s, fields: s.fields.map((f) => (f.id !== fieldId ? f : { ...f, value })) },
      ),
    })
  }
  function downloadMarkdown() {
    const md = data.sections
      .map(
        (s) =>
          `## ${s.title}\n\n${s.fields
            .map((f) => `**${f.label}:** ${f.value || '_(blank)_'}`)
            .join('\n\n')}`,
      )
      .join('\n\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fafsa-draft.md'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="rounded-xl border border-border/60 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">FAFSA draft</h4>
        <button
          onClick={downloadMarkdown}
          className="text-xs text-[#1a6b5a] hover:underline flex items-center gap-1"
        >
          <Download className="h-3 w-3" /> Export
        </button>
      </div>
      <p className="text-[11px] rounded bg-amber-50 border border-amber-200 px-2 py-1.5 text-amber-900">
        This is a draft. PathwayAI does not submit anything on your behalf.
      </p>
      {data.sections.map((s) => (
        <div key={s.id} className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.title}</div>
          {s.fields.map((f) => (
            <div key={f.id} className="space-y-1">
              <label className="text-xs font-medium flex items-center gap-2">
                {f.label}
                {onAskExplain && (
                  <button
                    onClick={() => onAskExplain(f.id)}
                    className="text-[10px] text-[#1a6b5a] hover:underline"
                  >
                    what does this mean?
                  </button>
                )}
              </label>
              <input
                value={f.value}
                onChange={(e) => setField(s.id, f.id, e.target.value)}
                className="w-full px-2 py-1 rounded border border-border/60 text-sm"
              />
              {f.help && <p className="text-[10px] text-muted-foreground">{f.help}</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
