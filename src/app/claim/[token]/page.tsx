// src/app/claim/[token]/page.tsx
'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Header } from '@/components/layout/Header'

export default function Claim() {
  const router = useRouter()
  const { token } = useParams<{ token: string }>()
  const [displayName, setDisplayName] = useState('')
  const [kind, setKind] = useState<'parent' | 'counselor' | 'other'>('parent')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setErr(null)
    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, adult: { displayName, kind } }),
    })
    const j = await res.json()
    if (!res.ok) {
      setErr(j.error)
      setBusy(false)
      return
    }
    router.push(`/adult/${j.adultId}/student/${j.studentId}`)
  }

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="px-6 sm:px-10 py-16 max-w-md mx-auto space-y-6">
        <header>
          <div className="eyebrow-accent">A letter of introduction</div>
          <h1 className="font-display text-[32px] leading-[1.1] text-ink mt-1.5">
            A student shared their <span className="italic font-light text-forest">PathwayAI</span> context with you.
          </h1>
          <p className="text-[14.5px] text-ink-mid mt-3 font-display italic leading-relaxed">
            Create your account to read their notes and ask the assistant questions about how to help.
          </p>
        </header>

        <hr className="rule-h" />

        <div className="space-y-5">
          <div>
            <label className="eyebrow block mb-1.5">Your name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Maria’s mom"
              className="field-line w-full"
            />
          </div>
          <div>
            <label className="eyebrow block mb-1.5">Your relationship</label>
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
          {err && (
            <div className="border-l-2 border-rust bg-rust-soft px-3 py-2 text-[13px] text-rust">
              {err}
            </div>
          )}
          <button
            onClick={submit}
            disabled={busy || !displayName.trim()}
            className="btn-ink w-full"
          >
            {busy ? 'Accepting…' : 'Accept invitation'}
            <span className="font-display italic opacity-80">→</span>
          </button>
        </div>
      </main>
    </div>
  )
}
