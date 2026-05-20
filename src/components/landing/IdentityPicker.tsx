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
      role === 'student'
        ? { role, displayName }
        : { role, displayName, kind }
    const res = await fetch('/api/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const { id, role: newRole } = await res.json()
    router.push(newRole === 'student' ? `/student/${id}` : `/adult/${id}`)
  }

  return (
    <div className="max-w-md mx-auto mt-8 space-y-4">
      {role === 'student' && existing.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Continue as
          </div>
          {existing.map((s) => (
            <button
              key={s.id}
              disabled={busy}
              onClick={() => pickExisting(s.id)}
              className="w-full text-left p-3 rounded-lg border border-border/60 bg-white hover:bg-[#1a6b5a]/5"
            >
              <div className="font-medium">{s.displayName}</div>
              {s.personaId && (
                <div className="text-xs text-muted-foreground">{s.personaId}</div>
              )}
            </button>
          ))}
          <div className="text-xs uppercase tracking-wider text-muted-foreground pt-4">
            Or start fresh
          </div>
        </div>
      )}
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Your first name"
        className="w-full px-3 py-2 rounded-lg border border-border/60"
      />
      {role === 'adult' && (
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="w-full px-3 py-2 rounded-lg border border-border/60"
        >
          <option value="parent">Parent / guardian</option>
          <option value="counselor">Counselor</option>
          <option value="other">Other caring adult</option>
        </select>
      )}
      <button
        disabled={busy || !displayName.trim()}
        onClick={createNew}
        className="w-full px-4 py-2 rounded-lg bg-[#1a6b5a] text-white disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  )
}
