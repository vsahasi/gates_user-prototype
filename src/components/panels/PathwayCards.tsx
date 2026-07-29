// src/components/panels/PathwayCards.tsx
import type { PathwayCardsData, PathwayCard } from '@/lib/types'

interface PathwayCardsProps {
  data: PathwayCardsData
  selectedPathwayIds?: Set<string>
  onToggleSelect?: (pathway: PathwayCard) => void
}

const FIT_CONFIG = {
  high:   { label: 'Strong fit',      text: 'text-forest',  bg: 'bg-forest-soft border-forest/20' },
  medium: { label: 'Worth exploring', text: 'text-marigold', bg: 'bg-amber-50 border-marigold/25' },
  low:    { label: 'Stretch',         text: 'text-rust',    bg: 'bg-rust-soft border-rust/20' },
}

const TYPE_LABELS: Record<string, string> = {
  community_college: 'Community college',
  '4_year': 'Four-year university',
  trade: 'Trade / vocational',
  military: 'Military',
  tribal: 'Tribal college',
  apprenticeship: 'Apprenticeship',
}

export function PathwayCards({ data, selectedPathwayIds, onToggleSelect }: PathwayCardsProps) {
  return (
    <div className="flex gap-4 overflow-x-auto refined-scroll pb-3 -mx-1 px-1 snap-x snap-mandatory">
      {data.pathways.map((pathway, i) => (
        <PathwayCardItem
          key={i}
          pathway={pathway}
          index={i}
          isSelected={selectedPathwayIds?.has(pathway.title) ?? false}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  )
}

function PathwayCardItem({
  pathway,
  index,
  isSelected,
  onToggleSelect,
}: {
  pathway: PathwayCard
  index: number
  isSelected: boolean
  onToggleSelect?: (pathway: PathwayCard) => void
}) {
  const fit = FIT_CONFIG[pathway.fit] ?? FIT_CONFIG.medium
  const interactive = !!onToggleSelect
  return (
    <article
      onClick={interactive ? () => onToggleSelect!(pathway) : undefined}
      className={[
        'min-w-[315px] max-w-[360px] snap-start almanac-card hover:shadow-[0_10px_24px_rgba(13,74,61,0.08)] hover:-translate-y-0.5 transition-all animate-slide-up flex flex-col overflow-hidden',
        interactive ? 'cursor-pointer' : '',
        isSelected ? 'border-forest bg-forest-soft' : '',
      ].join(' ')}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <header className={`px-5 pt-5 pb-4 border-b border-rule ${isSelected ? 'bg-forest-soft/60' : 'bg-card'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="eyebrow pt-1">{TYPE_LABELS[pathway.type] ?? pathway.type}</div>
          <div className="flex items-center gap-2 shrink-0">
            {isSelected && (
              <span className="text-[10px] font-mono uppercase tracking-[0.13em] px-2 py-1 border border-forest/30 bg-forest-soft text-forest leading-none">
                ◆ selected
              </span>
            )}
            <span
              className={`text-[10px] font-mono uppercase tracking-[0.13em] px-2 py-1 border rounded-sm leading-none ${fit.bg} ${fit.text}`}
            >
              {fit.label}
            </span>
          </div>
        </div>
        <h3 className="font-display text-[21px] text-ink leading-[1.15] mt-2.5">
          {pathway.title}
        </h3>
      </header>

      <p className="px-5 pt-4 text-[14px] text-ink-mid leading-[1.65] flex-1">
        {pathway.description}
      </p>

      <dl className="mx-5 mt-5 rounded-md border border-rule bg-paper-warm/35 divide-y divide-rule">
        <Datum label="Duration" value={pathway.timeToComplete} />
        <Datum label="Cost" value={pathway.estimatedCost} />
        <Datum label="Earnings" value={pathway.earnings} />
      </dl>

      <footer className="px-5 py-4 mt-5 border-t border-rule bg-paper-warm/45">
        <div className="eyebrow mb-2">Next step</div>
        <p className="text-[13.5px] text-ink leading-[1.55] flex gap-2">
          <span className="font-display italic text-forest text-[18px] leading-none mt-0.5">›</span>
          {pathway.nextStep}
        </p>
      </footer>
    </article>
  )
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] items-start gap-3 px-3.5 py-3">
      <dt className="eyebrow text-[9.5px] leading-5">{label}</dt>
      <dd className="text-[13.5px] text-ink leading-[1.35] font-medium">
        {value}
      </dd>
    </div>
  )
}
