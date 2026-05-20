// src/components/layout/LeftRail.tsx
'use client'
import Link from 'next/link'
import { Plus, Share2, Download, LogOut } from 'lucide-react'
import type { Conversation, Student } from '@/lib/db/queries'

interface Props {
  student: Student
  conversations: Conversation[]
  activeConvId: string
  onNew: () => void
  onShare: () => void
  onExport: () => void
}

export function LeftRail({
  student,
  conversations,
  activeConvId,
  onNew,
  onShare,
  onExport,
}: Props) {
  return (
    <aside className="w-[260px] shrink-0 border-r border-border/60 bg-[#f5f5f2] flex flex-col h-[calc(100vh-53px)]">
      <div className="p-4 border-b border-border/60">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Signed in as</div>
        <div className="font-medium truncate">{student.displayName}</div>
      </div>
      <button
        onClick={onNew}
        className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg bg-white border border-border/60 text-sm flex items-center gap-2 hover:border-[#1a6b5a]/50"
      >
        <Plus className="h-4 w-4" /> New conversation
      </button>
      <div className="flex-1 overflow-y-auto refined-scroll px-2 py-2 space-y-1">
        {conversations.map((c) => (
          <Link
            key={c.id}
            href={`/student/${student.id}/${c.id}`}
            className={`block px-3 py-2 rounded-lg text-sm truncate ${
              c.id === activeConvId ? 'bg-white border border-border/60' : 'hover:bg-white/60'
            }`}
          >
            {c.title}
          </Link>
        ))}
      </div>
      <div className="border-t border-border/60 p-2 space-y-1">
        <button
          onClick={onShare}
          className="w-full px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-white/60"
        >
          <Share2 className="h-4 w-4" /> Share with parent / counselor
        </button>
        <button
          onClick={onExport}
          className="w-full px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-white/60"
        >
          <Download className="h-4 w-4" /> Export my memory
        </button>
        <Link
          href="/"
          className="w-full px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-white/60"
        >
          <LogOut className="h-4 w-4" /> Switch role
        </Link>
      </div>
    </aside>
  )
}
