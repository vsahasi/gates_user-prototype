// src/app/import/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'

export default function ImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!file) return
    setBusy(true)
    setErr(null)
    const text = await file.text()
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: text,
    })
    const j = await res.json()
    if (!res.ok) {
      setErr(j.error)
      setBusy(false)
      return
    }
    router.push(`/student/${j.studentId}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 sm:px-6 py-10 max-w-md mx-auto space-y-4">
        <h1 className="text-xl font-semibold">Restore from export</h1>
        <p className="text-sm text-muted-foreground">
          Upload a JSON file you exported from PathwayAI to restore your memory on this device.
        </p>
        <input
          type="file"
          accept="application/json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
        {err && <div className="text-sm text-rose-700">{err}</div>}
        <button
          onClick={submit}
          disabled={!file || busy}
          className="w-full px-4 py-2 rounded-lg bg-[#1a6b5a] text-white disabled:opacity-50"
        >
          Restore
        </button>
      </main>
    </div>
  )
}
