// src/components/panels/JourneyPhase.tsx

interface Phase {
  id: string
  label: string
}

interface JourneyPhaseProps {
  phases: Phase[]
  currentPhase: string
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

export function JourneyPhase({ phases, currentPhase }: JourneyPhaseProps) {
  const currentIdx = phases.findIndex((p) => p.id === currentPhase)

  return (
    <div className="space-y-0">
      {phases.map((phase, i) => {
        const isActive = phase.id === currentPhase
        const isComplete = i < currentIdx
        const isFuture = i > currentIdx
        const isLast = i === phases.length - 1
        return (
          <div key={phase.id} className="flex items-stretch gap-3 relative">
            <div className="flex flex-col items-center w-6">
              <span
                className={`font-display text-[13px] leading-7 transition-colors ${
                  isActive
                    ? 'text-forest font-semibold'
                    : isComplete
                      ? 'text-forest/60'
                      : 'text-ink-faint'
                }`}
              >
                {ROMAN[i]}
              </span>
              {!isLast && (
                <span
                  className={`w-px flex-1 ${
                    isComplete ? 'bg-forest/40' : 'bg-rule'
                  }`}
                />
              )}
            </div>
            <div className="flex-1 py-1 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[13.5px] font-display ${
                    isActive
                      ? 'text-ink font-medium'
                      : isComplete
                        ? 'text-ink-mid'
                        : isFuture
                          ? 'text-ink-faint'
                          : 'text-ink-mid'
                  }`}
                >
                  {phase.label}
                </span>
                {isActive && (
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-forest bg-forest-soft border border-forest/20 rounded-sm px-1.5 py-0.5">
                    now
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
