// src/app/page.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { RolePicker } from '@/components/landing/RolePicker'
import { IdentityPicker } from '@/components/landing/IdentityPicker'

export default function Home() {
  const [role, setRole] = useState<'student' | 'adult' | null>(null)
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 sm:px-6 py-10 sm:py-16">
        {role === null ? (
          <>
            <h1 className="text-2xl sm:text-3xl font-semibold text-center mb-2">
              Welcome to PathwayAI
            </h1>
            <p className="text-center text-muted-foreground mb-8">
              Tell us who you are so we can help.
            </p>
            <RolePicker onPick={setRole} />
            <div className="text-center mt-8">
              <Link
                href="/import"
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                …or restore from a previous export
              </Link>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setRole(null)}
              className="text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              ← back
            </button>
            <IdentityPicker role={role} />
          </>
        )}
      </main>
    </div>
  )
}
