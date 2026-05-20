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
    <figure className="almanac-card animate-slide-up">
      <figcaption className="px-5 pt-4 pb-3 border-b border-rule flex items-baseline justify-between gap-4">
        <div>
          <div className="eyebrow-accent">Draft · FAFSA</div>
          <h4 className="font-display text-[18px] text-ink mt-0.5 leading-tight">
            Free Application for Federal Student Aid
          </h4>
        </div>
        <button
          onClick={downloadMarkdown}
          className="pen-underline text-[12px] text-forest flex items-center gap-1"
        >
          <Download className="h-3 w-3" /> Export
        </button>
      </figcaption>

      <div className="mx-5 mt-4 px-3 py-2 border-l-2 border-rust bg-rust-soft text-[12px] text-rust leading-relaxed">
        <span className="font-display italic font-semibold">A note —</span> this is a draft.
        PathwayAI does not submit anything on your behalf.
      </div>

      <div className="px-5 pt-4 pb-5 space-y-5">
        {data.sections.map((s) => (
          <section key={s.id}>
            <div className="caps-sm border-b border-rule pb-1.5 mb-3">{s.title}</div>
            <div className="space-y-3">
              {s.fields.map((f) => (
                <div key={f.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <label className="font-display text-[13.5px] text-ink leading-snug">
                      {f.label}
                    </label>
                    {onAskExplain && (
                      <button
                        onClick={() => onAskExplain(f.id)}
                        className="pen-underline text-[11px] text-forest italic font-display shrink-0"
                      >
                        explain →
                      </button>
                    )}
                  </div>
                  <input
                    value={f.value}
                    onChange={(e) => setField(s.id, f.id, e.target.value)}
                    className="field-line w-full mt-1"
                  />
                  {f.help && (
                    <p className="text-[11px] text-ink-soft italic font-display mt-1">
                      {f.help}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </figure>
  )
}
