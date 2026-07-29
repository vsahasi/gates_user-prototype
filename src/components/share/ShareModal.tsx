// src/components/share/ShareModal.tsx
'use client'
import { useState } from 'react'

interface Props {
  studentId: string
  onClose: () => void
}

export function ShareModal({ studentId, onClose }: Props) {
  const [kind, setKind] = useState<'parent' | 'counselor' | 'other'>('parent')
  const [ttlDays, setTtlDays] = useState(7)
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function generate() {
    setBusy(true)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, kind, ttlMs: ttlDays * 24 * 60 * 60 * 1000 }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.token) {
        setLink(null)
        alert(j.error ?? 'Could not create the share link. Please try again.')
        return
      }
      setLink(`${window.location.origin}/claim/${j.token}`)
    } catch {
      setLink(null)
      alert('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink/35 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-rule shadow-[0_24px_60px_rgba(0,0,0,0.16)] w-full max-w-md p-7 space-y-5 animate-slide-up"
        style={{ borderRadius: 6 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow-accent">Letter of introduction</div>
            <h3 className="font-display text-[24px] text-ink mt-1 leading-tight">
              Share with a <span className="italic font-light text-forest">caring adult</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-soft hover:text-ink text-2xl leading-none -mt-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {!link ? (
          <>
            <div>
              <label className="eyebrow block mb-1.5">Who is this for?</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                className="field-box w-full"
              >
                <option value="parent">Parent or guardian</option>
                <option value="counselor">School counselor</option>
                <option value="other">Other caring adult</option>
              </select>
            </div>
            <div>
              <label className="eyebrow block mb-1.5">The link expires in</label>
              <div className="flex gap-2">
                {[1, 7, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setTtlDays(d)}
                    className={`flex-1 py-2 px-3 text-[13px] border rounded-sm transition-colors ${
                      ttlDays === d
                        ? 'bg-ink text-paper border-ink'
                        : 'bg-card text-ink-mid border-rule hover:border-forest'
                    }`}
                  >
                    <span className="font-display">{d}</span>
                    <span className="font-mono text-[10.5px] uppercase tracking-wider ml-1 opacity-70">
                      {d === 1 ? 'day' : 'days'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={generate} disabled={busy} className="btn-forest w-full">
              {busy ? 'Generating…' : 'Generate invitation'}
              <span className="font-display italic opacity-80">→</span>
            </button>
          </>
        ) : (
          <>
            <p className="text-[14px] text-ink-mid leading-relaxed">
              Send this link to the person you&apos;d like to bring into the conversation.
            </p>
            <input
              value={link}
              readOnly
              className="field-box w-full font-mono text-[11.5px]"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => navigator.clipboard.writeText(link)}
              className="btn-ink w-full"
            >
              Copy link
              <span className="font-display italic opacity-80">⌘ C</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
