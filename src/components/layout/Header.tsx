'use client'
// src/components/layout/Header.tsx
import Link from 'next/link'

interface HeaderProps {
  personaName?: string
  sessionId?: string
}

export function Header({ personaName, sessionId }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between px-6 py-3.5">
        <Link href="/" className="group flex items-baseline gap-3">
          {/* Wordmark: small Roman numeral chapter mark + serif word */}
          <span
            aria-hidden
            className="font-display text-[15px] italic text-forest leading-none"
          >
            §
          </span>
          <span className="font-display text-[20px] font-medium tracking-tight text-ink leading-none transition-colors group-hover:text-forest-deep">
            Pathway<span className="italic font-normal text-forest">Almanac</span>
          </span>
          <span className="eyebrow ml-1 hidden sm:inline">est. 2026</span>
        </Link>

        <div className="flex items-center gap-3">
          {personaName && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="eyebrow">signed in as</span>
              <span className="font-display text-[15px] italic text-ink">
                {personaName}
              </span>
            </div>
          )}
          {sessionId && (
            <Link href="/" className="btn-ghost">
              ↻ New session
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
