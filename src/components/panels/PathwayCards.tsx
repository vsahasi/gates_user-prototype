// src/components/panels/PathwayCards.tsx
import type { PathwayCardsData, PathwayCard } from '@/lib/types'

const FIT_CONFIG = {
  high:   { label: 'Strong fit',       text: 'text-forest',  bg: 'bg-forest-soft border-forest/25' },
  medium: { label: 'Worth exploring',  text: 'text-marigold', bg: 'bg-amber-50 border-marigold/30' },
  low:    { label: 'Stretch',          text: 'text-rust',    bg: 'bg-rust-soft border-rust/25' },
}

const TYPE_LABELS: Record<string, string> = {
  community_college: 'Community college',
  '4_year': 'Four-year university',
  trade: 'Trade / vocational',
  military: 'Military',
  tribal: 'Tribal college',
  apprenticeship: 'Apprenticeship',
}

export function PathwayCards({ data }: { data: PathwayCardsData }) {
  return (
    <div className="flex gap-3 overflow-x-auto refined-scroll pb-3 -mx-1 px-1 snap-x snap-mandatory">
      {data.pathways.map((pathway, i) => (
        <PathwayCardItem key={i} pathway={pathway} index={i} />
      ))}
    </div>
  )
}

function PathwayCardItem({ pathway, index }: { pathway: PathwayCard; index: number }) {
  const fit = FIT_CONFIG[pathway.fit]
  return (
    <article
      className="min-w-[280px] max-w-[320px] snap-start almanac-card hover:shadow-[0_8px_20px_rgba(13,74,61,0.08)] hover:-translate-y-0.5 transition-all animate-slide-up flex flex-col"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <header className="px-4 pt-4 pb-3 border-b border-rule">
        <div className="flex items-baseline justify-between gap-2">
          <div className="eyebrow">{TYPE_LABELS[pathway.type] ?? pathway.type}</div>
          <span
            className={`text-[10.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 border rounded-sm ${fit.bg} ${fit.text}`}
          >
            {fit.label}
          </span>
        </div>
        <h3 className="font-display text-[19px] text-ink leading-tight mt-1.5">
          {pathway.title}
        </h3>
      </header>

      <p className="px-4 pt-3 text-[13.5px] text-ink-mid leading-relaxed flex-1">
        {pathway.description}
      </p>

      <dl className="grid grid-cols-3 px-4 py-3 border-t border-rule mt-3 gap-x-2">
        <Datum label="Duration" value={pathway.timeToComplete} />
        <Datum label="Cost" value={pathway.estimatedCost} />
        <Datum label="Earnings" value={pathway.earnings} />
      </dl>

      <footer className="px-4 py-3 border-t border-rule bg-paper-warm/40">
        <div className="eyebrow mb-1">Next step</div>
        <p className="text-[13px] text-ink leading-snug">
          <span className="font-display italic text-forest mr-1">›</span>
          {pathway.nextStep}
        </p>
      </footer>
    </article>
  )
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="serif-numeral text-[15px] text-ink leading-tight">{value}</div>
      <div className="eyebrow mt-0.5 text-[9.5px]">{label}</div>
    </div>
  )
}
