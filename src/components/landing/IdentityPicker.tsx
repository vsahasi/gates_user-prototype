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

  useEffect(() => {
    if (role !== 'student') return
    fetch('/api/identity')
      .then((r) => r.json())
      .then((j) => setExisting(j.students))
  }, [role])

  async function pickExisting(id: string) {
    setBusy(true)
    const res = await fetch('/api/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, existingId: id }),
    })
    const { id: newId, role: newRole } = await res.json()
    router.push(newRole === 'student' ? `/student/${newId}` : `/adult/${newId}`)
  }

  async function createNew() {
    if (!displayName.trim()) return
    setBusy(true)
    const body =
      role === 'student' ? { role, displayName } : { role, displayName, kind }
    const res = await fetch('/api/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const { id, role: newRole } = await res.json()
    router.push(newRole === 'student' ? `/student/${id}` : `/adult/${id}`)
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
      </div>
    </div>
  )
}
