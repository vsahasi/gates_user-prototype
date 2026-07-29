// src/components/landing/IdentityPicker.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ExistingStudent {
  id: string
  displayName: string
  personaId: string | null
}

export function IdentityPicker({ role }: { role: 'student' | 'adult' }) {
  const router = useRouter()
  const [existing, setExisting] = useState<ExistingStudent[]>([])
  const [displayName, setDisplayName] = useState('')
  const [kind, setKind] = useState<'parent' | 'counselor' | 'other'>('parent')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (role !== 'student') return
    fetch('/api/identity')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setExisting(Array.isArray(j.students) ? j.students : []))
      .catch(() => setExisting([]))
  }, [role])

  async function submitIdentity(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.id) {
        setError(j.error ?? 'Something went wrong creating your profile. Please try again.')
        setBusy(false)
        return
      }
      router.push(j.role === 'student' ? `/student/${j.id}` : `/adult/${j.id}`)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setBusy(false)
    }
  }

  function pickExisting(id: string) {
    void submitIdentity({ role, existingId: id })
  }

  function createNew() {
    if (!displayName.trim()) return
    void submitIdentity(
      role === 'student' ? { role, displayName } : { role, displayName, kind },
    )
  }

  const roleWord = role === 'student' ? 'student' : 'caring adult'

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow-accent">Step II · Identify</div>
        <h2 className="font-display text-[34px] leading-tight text-ink mt-2">
          Welcome, <span className="italic font-light text-forest">{roleWord}</span>.
        </h2>
      </div>

      {role === 'student' && existing.length > 0 && (
        <div className="space-y-2">
          <div className="caps-sm">Continue as</div>
          <div className="space-y-1.5">
            {existing.map((s) => (
              <button
                key={s.id}
                disabled={busy}
                onClick={() => pickExisting(s.id)}
                className="w-full text-left almanac-panel px-4 py-3 hover:border-forest hover:bg-forest-soft transition-colors group"
              >
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="font-display text-[18px] text-ink">{s.displayName}</div>
                    {s.personaId && (
                      <div className="text-[11px] text-ink-soft mt-0.5 font-mono">
                        {s.personaId}
                      </div>
                    )}
                  </div>
                  <span
                    aria-hidden
                    className="text-ink-faint group-hover:text-forest font-display"
                  >
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="rule-fancy mt-6"><span className="ornament">·  ·  ·</span></div>
          <div className="caps-sm pt-2">Or start fresh</div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="eyebrow block mb-1.5">Your first name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Maya"
            className="field-line w-full"
          />
        </div>
        {role === 'adult' && (
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
        )}
        <button
          disabled={busy || !displayName.trim()}
          onClick={createNew}
          className="btn-ink w-full justify-center"
        >
          Continue
          <span className="font-display italic text-[15px] opacity-80">→</span>
        </button>
        {error && (
          <p role="alert" className="text-[13px] leading-relaxed text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
