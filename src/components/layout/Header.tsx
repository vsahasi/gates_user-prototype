// src/components/layout/Header.tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface HeaderProps {
  personaName?: string
  sessionId?: string
}

export function Header({ personaName, sessionId }: HeaderProps) {
  return (
    <header className="border-b px-6 py-3 flex items-center justify-between bg-background sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-lg font-bold tracking-tight hover:opacity-80 transition-opacity">
          PathwayAI
        </Link>
        <Badge variant="secondary" className="text-xs">Gates Prototype</Badge>
        {personaName && (
          <Badge variant="outline" className="text-xs">
            {personaName}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {sessionId && (
          <Link href="/">
            <Button variant="ghost" size="sm">Switch Persona</Button>
          </Link>
        )}
      </div>
    </header>
  )
}
