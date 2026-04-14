// src/components/panels/TimelineChecklist.tsx
import type { TimelineChecklistData } from '@/lib/types'

export function TimelineChecklist({ data }: { data: TimelineChecklistData }) {
  return (
    <div className="rounded-lg border bg-card p-4 my-2 space-y-3">
      <h3 className="font-semibold text-sm">{data.title}</h3>
      <div className="space-y-3">
        {data.items.map((item, i) => (
          <div key={i} className="flex gap-3">
            <div className="shrink-0 w-16 text-xs text-muted-foreground pt-0.5">{item.week}</div>
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium">{item.task}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
              {item.deadline && (
                <p className="text-xs text-orange-600 font-medium">Due: {item.deadline}</p>
              )}
              {item.resource && (
                <a
                  href={item.resource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline"
                >
                  Resource →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
