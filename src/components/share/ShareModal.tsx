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
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, kind, ttlMs: ttlDays * 24 * 60 * 60 * 1000 }),
    })
    const { token } = await res.json()
    setLink(`${window.location.origin}/claim/${token}`)
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold">Share with a caring adult</h3>
          <button onClick={onClose} className="text-muted-foreground">
            ×
          </button>
        </div>
        {!link ? (
          <>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Who is this for?
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                className="w-full px-3 py-2 rounded-lg border border-border/60"
              >
                <option value="parent">Parent / guardian</option>
                <option value="counselor">Counselor</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Link expires in
              </label>
              <select
                value={ttlDays}
                onChange={(e) => setTtlDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-border/60"
              >
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>
            <button
              onClick={generate}
              disabled={busy}
              className="w-full px-4 py-2 rounded-lg bg-[#1a6b5a] text-white disabled:opacity-50"
            >
              Generate link
            </button>
          </>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              Send this link to the person you want to share with:
            </div>
            <input
              value={link}
              readOnly
              className="w-full px-3 py-2 rounded-lg border border-border/60 text-sm"
            />
            <button
              onClick={() => navigator.clipboard.writeText(link)}
              className="w-full px-4 py-2 rounded-lg bg-[#1a6b5a] text-white"
            >
              Copy link
            </button>
          </>
        )}
      </div>
    </div>
  )
}
