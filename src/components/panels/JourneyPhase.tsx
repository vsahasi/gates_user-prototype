// src/components/panels/JourneyPhase.tsx
import { Check } from 'lucide-react'

interface Phase {
  id: string
  label: string
}

interface JourneyPhaseProps {
  phases: Phase[]
  currentPhase: string
}

export function JourneyPhase({ phases, currentPhase }: JourneyPhaseProps) {
  const currentIdx = phases.findIndex((p) => p.id === currentPhase)

  return (
    <div className="px-4 py-4">
      <div className="space-y-1">
        {phases.map((phase, i) => {
          const isActive = phase.id === currentPhase
          const isComplete = i < currentIdx
          const isFuture = i > currentIdx

          return (
            <div key={phase.id} className="flex items-center gap-3">
              {/* Dot / check */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#1a6b5a] text-white shadow-sm shadow-[#1a6b5a]/25'
                      : isComplete
                        ? 'bg-[#1a6b5a]/15 text-[#1a6b5a]'
                        : 'bg-muted text-muted-foreground/50'
                  }`}
                >
                  {isComplete ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                {i < phases.length - 1 && (
                  <div
                    className={`w-0.5 h-4 mt-0.5 rounded-full ${
                      isComplete ? 'bg-[#1a6b5a]/20' : 'bg-border'
                    }`}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-sm leading-6 ${
                  isActive
                    ? 'font-semibold text-foreground'
                    : isComplete
                      ? 'font-medium text-muted-foreground'
                      : isFuture
                        ? 'text-muted-foreground/50'
                        : 'text-muted-foreground'
                }`}
              >
                {phase.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
