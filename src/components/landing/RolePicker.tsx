// src/components/landing/RolePicker.tsx
'use client'
import { useState } from 'react'

type Role = 'student' | 'adult'

export function RolePicker({ onPick }: { onPick: (r: Role) => void }) {
  const [hover, setHover] = useState<Role | null>(null)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
      {(['student', 'adult'] as Role[]).map((r) => (
        <button
          key={r}
          onClick={() => onPick(r)}
          onMouseEnter={() => setHover(r)}
          onMouseLeave={() => setHover(null)}
          className={`rounded-2xl border p-6 text-left transition-all ${
            hover === r ? 'border-[#1a6b5a] bg-[#1a6b5a]/5' : 'border-border/60 bg-white'
          }`}
        >
          <div className="text-lg font-semibold">
            {r === 'student' ? 'I’m a student' : 'I’m a parent or counselor'}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {r === 'student'
              ? 'Explore careers, schools, and your next steps.'
              : 'Support a student you care about with shared context.'}
          </div>
        </button>
      ))}
    </div>
  )
}
