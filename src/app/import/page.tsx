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
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="px-6 sm:px-10 py-16 max-w-md mx-auto space-y-6">
        <header>
          <div className="eyebrow-accent">A returning journal</div>
          <h1 className="font-display text-[32px] leading-[1.1] text-ink mt-1.5">
            Restore from a <span className="italic font-light text-forest">previous export</span>.
          </h1>
          <p className="text-[14.5px] text-ink-mid mt-3 font-display italic leading-relaxed">
            Upload the JSON file you saved. Your conversations, profile, and notes will come back
            onto this device.
          </p>
        </header>

        <hr className="rule-h" />

        <label className="block almanac-inset rounded-sm border-dashed border-2 px-5 py-8 text-center cursor-pointer hover:border-forest hover:bg-forest-soft transition-colors">
          <input
            type="file"
            accept="application/json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <div className="font-display text-[18px] text-ink">
            {file ? file.name : 'Drop a JSON file or click to choose'}
          </div>
          <div className="eyebrow mt-1">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : 'pathwayai-memory-*.json'}
          </div>
        </label>

        {err && (
          <div className="border-l-2 border-rust bg-rust-soft px-3 py-2 text-[13px] text-rust">
            {err}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!file || busy}
          className="btn-ink w-full"
        >
          {busy ? 'Restoring…' : 'Restore my almanac'}
          <span className="font-display italic opacity-80">↩</span>
        </button>
      </main>
    </div>
  )
}
