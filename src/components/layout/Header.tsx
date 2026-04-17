'use client'
// src/components/layout/Header.tsx
import Link from 'next/link'
import { Compass, ChevronRight } from 'lucide-react'

interface HeaderProps {
  personaName?: string
  sessionId?: string
}

export function Header({ personaName, sessionId }: HeaderProps) {
  return (
    <header className="border-b border-border/60 px-5 py-3 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a6b5a] to-[#2d8a73]">
            <Compass className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">PathwayAI</span>
        </Link>
        {personaName && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-sm text-muted-foreground font-medium">{personaName}&apos;s Session</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {sessionId && (
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-muted/60"
          >
            New Session
          </Link>
        )}
      </div>
    </header>
  )
}
