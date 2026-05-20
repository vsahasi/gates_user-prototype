// src/components/layout/RightRail.tsx
'use client'
import { ProfilePanel } from '@/components/panels/ProfilePanel'
import { JourneyPhase } from '@/components/panels/JourneyPhase'
import { HowWeGotHere } from '@/components/trust/HowWeGotHere'
import type { StudentProfile } from '@/lib/types'
import type { Signals } from '@/lib/adaptive/signals'

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
  signals?: Signals
  citations?: Array<{ source: string }>
}

export function RightRail({
  profile,
  onProfileChange,
  currentPhase,
  signals,
  citations,
}: Props) {
  return (
    <aside className="w-[320px] shrink-0 border-l border-rule bg-paper-warm flex flex-col h-[calc(100vh-57px)] overflow-y-auto refined-scroll">
      <Section eyebrow="The student" title="Your profile">
        <ProfilePanel profile={profile} onUpdate={onProfileChange} />
      </Section>

      <Section eyebrow="Where you are" title="Your journey">
        <JourneyPhase phases={PHASES} currentPhase={currentPhase} />
      </Section>

      {(signals || (citations && citations.length > 0)) && (
        <Section eyebrow="Behind the answer" title="How we got here" noBorder>
          <HowWeGotHere signals={signals} citations={citations} />
        </Section>
      )}

      <div className="px-5 py-6 border-t border-rule text-[11.5px] text-ink-soft">
        <p className="font-display italic leading-relaxed">
          &ldquo;Plans are nothing; planning is everything.&rdquo;
        </p>
        <p className="eyebrow mt-2 text-right">— Eisenhower</p>
      </div>
    </aside>
  )
}

function Section({
  eyebrow,
  title,
  noBorder,
  children,
}: {
  eyebrow: string
  title: string
  noBorder?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={noBorder ? '' : 'border-b border-rule'}>
      <header className="px-5 pt-5 pb-2.5">
        <div className="eyebrow-accent">{eyebrow}</div>
        <h3 className="font-display text-[18px] text-ink mt-0.5 leading-tight">{title}</h3>
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  )
}
