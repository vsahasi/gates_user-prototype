// src/components/panels/PathwayCards.tsx
import type { PathwayCardsData, PathwayCard } from '@/lib/types'

const FIT_COLORS = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
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
    <div className="grid gap-3 my-2">
      {data.pathways.map((pathway, i) => (
        <PathwayCardItem key={i} pathway={pathway} />
      ))}
    </div>
  )
}

function PathwayCardItem({ pathway }: { pathway: PathwayCard }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">{pathway.title}</h3>
          <span className="text-xs text-muted-foreground">{TYPE_LABELS[pathway.type] ?? pathway.type}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FIT_COLORS[pathway.fit]}`}>
          {pathway.fit === 'high' ? 'Strong fit' : pathway.fit === 'medium' ? 'Worth exploring' : 'Challenging fit'}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{pathway.description}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground block">Time</span>
          <span className="font-medium">{pathway.timeToComplete}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Est. Cost</span>
          <span className="font-medium">{pathway.estimatedCost}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Earnings</span>
          <span className="font-medium">{pathway.earnings}</span>
        </div>
      </div>
      <div className="pt-1 border-t">
        <span className="text-xs text-muted-foreground">Next step: </span>
        <span className="text-xs font-medium">{pathway.nextStep}</span>
      </div>
    </div>
  )
}
