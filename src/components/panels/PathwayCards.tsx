// src/components/panels/PathwayCards.tsx
import type { PathwayCardsData, PathwayCard } from '@/lib/types'
import { GraduationCap, Clock, DollarSign, TrendingUp, ArrowRight } from 'lucide-react'

const FIT_CONFIG = {
  high: { label: 'Strong fit', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  medium: { label: 'Worth exploring', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  low: { label: 'Stretch', bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-400' },
}

const TYPE_LABELS: Record<string, string> = {
  community_college: 'Community College',
  '4_year': '4-Year University',
  trade: 'Trade / Vocational',
  military: 'Military',
  tribal: 'Tribal College',
  apprenticeship: 'Apprenticeship',
}

export function PathwayCards({ data }: { data: PathwayCardsData }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
      {data.pathways.map((pathway, i) => (
        <PathwayCardItem key={i} pathway={pathway} index={i} />
      ))}
    </div>
  )
}

function PathwayCardItem({ pathway, index }: { pathway: PathwayCard; index: number }) {
  const fit = FIT_CONFIG[pathway.fit]

  return (
    <div
      className="min-w-[280px] max-w-[320px] snap-start rounded-xl border border-border/50 bg-white p-4 shadow-sm hover:shadow-md transition-shadow animate-slide-up flex flex-col"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1a6b5a]/8 text-[#1a6b5a]">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground leading-tight">{pathway.title}</h3>
            <span className="text-[11px] text-muted-foreground">{TYPE_LABELS[pathway.type] ?? pathway.type}</span>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full font-medium ${fit.bg} ${fit.text} shrink-0`}>
          <span className={`h-1.5 w-1.5 rounded-full ${fit.dot}`} />
          {fit.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-[13px] text-muted-foreground leading-relaxed mb-3 flex-1">{pathway.description}</p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-border/40 mb-3">
        <div className="flex flex-col items-center text-center">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/60 mb-1" />
          <span className="text-[11px] text-muted-foreground/70">Duration</span>
          <span className="text-xs font-semibold text-foreground">{pathway.timeToComplete}</span>
        </div>
        <div className="flex flex-col items-center text-center">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground/60 mb-1" />
          <span className="text-[11px] text-muted-foreground/70">Est. Cost</span>
          <span className="text-xs font-semibold text-foreground">{pathway.estimatedCost}</span>
        </div>
        <div className="flex flex-col items-center text-center">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/60 mb-1" />
          <span className="text-[11px] text-muted-foreground/70">Earnings</span>
          <span className="text-xs font-semibold text-foreground">{pathway.earnings}</span>
        </div>
      </div>

      {/* Next step */}
      <div className="flex items-center gap-2 text-[13px]">
        <ArrowRight className="h-3.5 w-3.5 text-[#1a6b5a] shrink-0" />
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">Next:</span> {pathway.nextStep}
        </span>
      </div>
    </div>
  )
}
