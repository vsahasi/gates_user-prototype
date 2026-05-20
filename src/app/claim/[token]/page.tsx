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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 sm:px-6 py-10 max-w-md mx-auto space-y-4">
        <h1 className="text-xl font-semibold">
          A student shared their PathwayAI context with you
        </h1>
        <p className="text-sm text-muted-foreground">
          Create your account to view their profile and ask your own questions about helping them.
        </p>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          className="w-full px-3 py-2 rounded-lg border border-border/60"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="w-full px-3 py-2 rounded-lg border border-border/60"
        >
          <option value="parent">Parent / guardian</option>
          <option value="counselor">Counselor</option>
          <option value="other">Other caring adult</option>
        </select>
        {err && <div className="text-sm text-rose-700">{err}</div>}
        <button
          onClick={submit}
          disabled={busy || !displayName.trim()}
          className="w-full px-4 py-2 rounded-lg bg-[#1a6b5a] text-white disabled:opacity-50"
        >
          Accept invitation
        </button>
      </main>
    </div>
  )
}
