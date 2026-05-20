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
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="px-6 sm:px-10 py-14 sm:py-24 max-w-[1180px] mx-auto">
        {role === null ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-16 lg:gap-24 items-start">
            {/* Left: editorial hero */}
            <div className="space-y-8 animate-fade-in">
              <div className="eyebrow-accent">A study companion for what&apos;s next</div>
              <h1 className="font-display text-[56px] sm:text-[68px] leading-[0.93] tracking-tight text-ink">
                Your next mile,{' '}
                <span className="italic font-light text-forest">considered</span>.
              </h1>
              <p className="text-[17px] leading-[1.7] text-ink-mid max-w-[34rem]">
                Choosing a college, a major, or a first career is not one decision — it&apos;s a long
                hallway of small ones. Pathway is a working notebook: it remembers what you&apos;ve
                told it, surfaces the data behind your options, and brings the adults you trust into
                the conversation when you want them.
              </p>
              <div className="flex items-center gap-6 pt-2">
                <div className="rule-fancy w-32"><span className="ornament">❦</span></div>
              </div>
              <div className="grid grid-cols-3 gap-6 max-w-md">
                <Stat label="schools indexed" value="6,000+" />
                <Stat label="occupations" value="900+" />
                <Stat label="cost / year" value="$0" />
              </div>
            </div>

            {/* Right: choose your way in */}
            <div className="animate-fade-in" style={{ animationDelay: '120ms' }}>
              <div className="caps-sm mb-4">Choose your entry</div>
              <RolePicker onPick={setRole} />
              <div className="mt-10 flex items-center gap-3 text-[13px] text-ink-soft">
                <hr className="rule-h flex-1" />
                <Link
                  href="/import"
                  className="pen-underline font-display italic text-ink-mid hover:text-forest"
                >
                  or restore from a previous export
                </Link>
                <hr className="rule-h flex-1" />
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto animate-fade-in">
            <button
              onClick={() => setRole(null)}
              className="eyebrow hover:text-ink transition-colors mb-6 inline-flex items-center gap-1"
            >
              ← back
            </button>
            <IdentityPicker role={role} />
          </div>
        )}
      </main>

      <footer className="border-t border-rule mt-24">
        <div className="mx-auto max-w-[1180px] px-6 sm:px-10 py-10 flex flex-col items-center gap-4 text-center">
          <div className="text-[11px] tracking-widest uppercase text-ink-soft font-sans">Built for the</div>
          <div className="font-display text-[22px] sm:text-[26px] leading-tight text-ink tracking-tight">
            Gates Foundation
          </div>
          <div className="rule-fancy w-48"><span className="ornament">❧</span></div>
          <div className="eyebrow text-ink-soft">by Ascend Consulting · UC Berkeley · MMXXVI</div>
        </div>
      </footer>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-rule-strong pl-4">
      <div className="serif-numeral text-[28px] leading-none text-forest-deep">{value}</div>
      <div className="eyebrow mt-1.5">{label}</div>
    </div>
  )
}
