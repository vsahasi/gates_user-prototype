// src/components/layout/LeftRail.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Conversation, Student } from '@/lib/db/queries'

interface Props {
  student: Student
  conversations: Conversation[]
  activeConvId: string
  onNew: () => void
  onShare: () => void
  onExport: () => void
}

function relativeShort(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000)
  if (d < 60) return 'now'
  if (d < 3600) return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

export function LeftRail({
  student,
  conversations,
  activeConvId,
  onNew,
  onShare,
  onExport,
}: Props) {
  const pathname = usePathname()
  const isPlanPage = pathname === `/student/${student.id}/plan`

  return (
    <aside className="w-[268px] shrink-0 border-r border-rule bg-paper-warm flex flex-col h-[calc(100vh-57px)]">
      {/* Identity card */}
      <div className="px-5 pt-5 pb-4 border-b border-rule">
        <div className="eyebrow">Logged journal of</div>
        <div className="font-display text-[22px] leading-tight text-ink mt-1">
          {student.displayName}
        </div>
        {student.personaId && (
          <div className="text-[11px] text-ink-soft font-mono mt-0.5">
            · {student.personaId}
          </div>
        )}
      </div>

      {/* My Plan link */}
      <div className="px-4 pt-4 pb-1">
        <Link
          href={`/student/${student.id}/plan`}
          className={`almanac-card block px-3.5 py-3 transition-colors ${
            isPlanPage
              ? 'bg-card border-forest'
              : 'hover:border-forest/40 hover:bg-card'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-forest font-display text-[16px] leading-none">◆</span>
              <span className="font-sans text-[13.5px] font-medium text-ink pen-underline">
                My plan
              </span>
            </div>
            <span className="text-ink-faint text-[13px]">→</span>
          </div>
          <div className="eyebrow mt-1 ml-6 text-forest/70">A snapshot of where you are</div>
        </Link>
      </div>

      {/* New conversation */}
      <button
        onClick={onNew}
        className="mx-4 mt-3 mb-2 btn-ghost justify-start border border-rule bg-card hover:bg-paper hover:border-forest/40"
      >
        <span className="font-display italic text-[15px] text-forest">+</span>
        <span>New conversation</span>
      </button>

      {/* Section heading */}
      <div className="px-5 pt-4 pb-1.5 flex items-center justify-between">
        <span className="eyebrow">Threads</span>
        <span className="eyebrow font-mono">
          {conversations.length.toString().padStart(2, '0')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto refined-scroll px-3 pb-3 space-y-0.5">
        {conversations.length === 0 && (
          <div className="px-3 py-6 text-[13px] text-ink-soft font-display italic">
            Nothing yet. Start with the question that&apos;s on your mind.
          </div>
        )}
        {conversations.map((c) => {
          const active = c.id === activeConvId
          return (
            <Link
              key={c.id}
              href={`/student/${student.id}/${c.id}`}
              className={`block px-3 py-2.5 rounded-sm text-[13.5px] transition-colors relative ${
                active
                  ? 'bg-card border border-rule shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
                  : 'hover:bg-card/60 border border-transparent'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-2 bottom-2 w-[2px] bg-forest -translate-x-3"
                />
              )}
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`truncate ${
                    active ? 'text-ink font-medium' : 'text-ink-mid'
                  }`}
                >
                  {c.title}
                </span>
                <span className="text-[10.5px] font-mono text-ink-faint shrink-0">
                  {relativeShort(c.lastMessageAt)}
                </span>
              </div>
              {c.phase && (
                <div className="eyebrow mt-1 text-[9.5px] text-forest/70">{c.phase}</div>
              )}
            </Link>
          )
        })}
      </div>

      {/* Footer actions */}
      <div className="border-t border-rule p-3 space-y-1">
        <button onClick={onShare} className="btn-ghost w-full justify-start">
          <span className="font-display italic text-forest">¶</span>
          <span>Share with a caring adult</span>
        </button>
        <button onClick={onExport} className="btn-ghost w-full justify-start">
          <span className="font-display italic text-forest">↓</span>
          <span>Export this almanac</span>
        </button>
        <Link href="/" className="btn-ghost w-full justify-start">
          <span className="font-display italic text-ink-soft">↩</span>
          <span>Switch role</span>
        </Link>
      </div>
    </aside>
  )
}
