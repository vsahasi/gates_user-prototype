// src/components/layout/RightRail.tsx
'use client'
import { ProfilePanel } from '@/components/panels/ProfilePanel'
import { JourneyPhase } from '@/components/panels/JourneyPhase'
import type { StudentProfile } from '@/lib/types'

type Phase = 'exploration' | 'preparation' | 'decision' | 'application' | 'transition'

const PHASES: { id: Phase; label: string }[] = [
  { id: 'exploration', label: 'Exploration' },
  { id: 'preparation', label: 'Preparation' },
  { id: 'decision', label: 'Decision' },
  { id: 'application', label: 'Application' },
  { id: 'transition', label: 'Transition' },
]

interface Props {
  profile: StudentProfile
  onProfileChange: (p: StudentProfile) => void
  currentPhase: Phase
}

export function RightRail({ profile, onProfileChange, currentPhase }: Props) {
  return (
    <aside className="w-[300px] shrink-0 border-l border-border/60 bg-[#f5f5f2] flex flex-col h-[calc(100vh-53px)] overflow-y-auto refined-scroll p-4 space-y-4">
      <div className="rounded-xl bg-white border border-border/60 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-r from-[#1a6b5a]/5 to-transparent">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1a6b5a]">
            Your Profile
          </h3>
        </div>
        <ProfilePanel profile={profile} onUpdate={onProfileChange} />
      </div>
      <div className="rounded-xl bg-white border border-border/60 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Journey
          </h3>
        </div>
        <JourneyPhase phases={PHASES} currentPhase={currentPhase} />
      </div>
    </aside>
  )
}
