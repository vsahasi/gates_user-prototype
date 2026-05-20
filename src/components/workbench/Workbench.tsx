// src/components/workbench/Workbench.tsx
'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MessageBubble, TypingIndicator } from '@/components/chat/MessageBubble'
import { ChatInput } from '@/components/chat/ChatInput'
import { ComparisonTable } from '@/components/panels/ComparisonTable'
import { PathwayCards } from '@/components/panels/PathwayCards'
import { TimelineChecklist } from '@/components/panels/TimelineChecklist'
import { DecisionMatrix } from '@/components/workbench/DecisionMatrix'
import { FinancialAidView } from '@/components/workbench/FinancialAidView'
import { FAFSADraft } from '@/components/workbench/FAFSADraft'
import { EssayDraft } from '@/components/workbench/EssayDraft'
import { LeftRail } from '@/components/layout/LeftRail'
import { RightRail } from '@/components/layout/RightRail'
import { ShareModal } from '@/components/share/ShareModal'
import { SCHOOLS } from '@/lib/data/schools'
import {
  parseStructuredComponentMessage,
  stripStructuredComponentForStream,
} from '@/lib/chat/structured-component'
import type {
  StudentProfile,
  StructuredComponent,
  Message,
  ComparisonTableData,
  PathwayCardsData,
  TimelineChecklistData,
  DecisionMatrixData,
  FinancialAidViewData,
  FAFSADraftData,
  EssayDraftData,
} from '@/lib/types'
import type { Student, Conversation, DbMessage, StudentSelection } from '@/lib/db/queries'

type Phase = 'exploration' | 'preparation' | 'decision' | 'application' | 'transition'

interface DisplayMessage extends Message {
  structuredComponent?: StructuredComponent
  isStreaming?: boolean
  citations?: Array<{ index: number; source: string }>
  rubricOverall?: number | null
  signals?: import('@/lib/adaptive/signals').Signals
}

function inferPhase(messages: DisplayMessage[]): Phase {
  const n = messages.filter((m) => m.role === 'user').length
  if (n <= 2) return 'exploration'
  if (n <= 5) return 'preparation'
  if (n <= 8) return 'decision'
  if (n <= 12) return 'application'
  return 'transition'
}

function renderStructuredComponent(
  component: StructuredComponent | undefined,
  onPatch: (slotKey: string, data: unknown) => void,
  messageKey: string,
  selectedUnitIds: Set<string>,
  selectedPathwayIds: Set<string>,
  onToggleSchool: (school: import('@/lib/types').School) => void,
  onTogglePathway: (pathway: import('@/lib/types').PathwayCard) => void,
) {
  if (!component) return null
  if (component.type === 'comparison_table') {
    const data = component.data as ComparisonTableData
    const schools = (data.schools as unknown as string[])
      .map((id) => SCHOOLS.find((s) => s.unitId === id))
      .filter(Boolean) as typeof SCHOOLS
    return (
      <ComparisonTable
        schools={schools}
        fields={data.fields}
        labels={data.labels}
        selectedUnitIds={selectedUnitIds}
        onToggleSelect={onToggleSchool}
      />
    )
  }
  if (component.type === 'pathway_cards') {
    return (
      <PathwayCards
        data={component.data as PathwayCardsData}
        selectedPathwayIds={selectedPathwayIds}
        onToggleSelect={onTogglePathway}
      />
    )
  }
  if (component.type === 'timeline_checklist') {
    return <TimelineChecklist data={component.data as TimelineChecklistData} />
  }
  if (component.type === 'decision_matrix') {
    return (
      <DecisionMatrix
        data={component.data as DecisionMatrixData}
        onChange={(next) => onPatch(`${messageKey}:decision_matrix`, next)}
      />
    )
  }
  if (component.type === 'financial_aid_view') {
    return (
      <FinancialAidView
        data={component.data as FinancialAidViewData}
        onChange={(next) => onPatch(`${messageKey}:financial_aid_view`, next)}
      />
    )
  }
  if (component.type === 'fafsa_draft') {
    return <FAFSADraft data={component.data as FAFSADraftData} />
  }
  if (component.type === 'essay_draft') {
    return <EssayDraft data={component.data as EssayDraftData} />
  }
  return null
}

interface Props {
  student: Student
  profile: StudentProfile
  conversation: Conversation
  conversations: Conversation[]
  messages: DbMessage[]
}

export function Workbench({
  student,
  profile: initialProfile,
  conversation,
  conversations,
  messages: initialMessages,
}: Props) {
  const router = useRouter()
  const [profile, setProfile] = useState<StudentProfile>(initialProfile)
  const [messages, setMessages] = useState<DisplayMessage[]>(() =>
    initialMessages.map((m) => ({
      role: m.role === 'system' ? 'assistant' : (m.role as 'user' | 'assistant'),
      content: m.content,
      timestamp: m.timestamp,
      structuredComponent: m.structuredComponentJson
        ? (JSON.parse(m.structuredComponentJson) as StructuredComponent)
        : undefined,
      citations: m.citationsJson ? JSON.parse(m.citationsJson) : undefined,
      rubricOverall: m.rubricScoreJson
        ? (JSON.parse(m.rubricScoreJson) as { overall?: number }).overall ?? null
        : null,
      signals: m.signalsJson ? JSON.parse(m.signalsJson) : undefined,
    })),
  )
  const [isLoading, setIsLoading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [workbenchState, setWorkbenchState] = useState<Record<string, unknown>>(() =>
    conversation.workbenchStateJson ? JSON.parse(conversation.workbenchStateJson) : {},
  )
  const [selections, setSelections] = useState<StudentSelection[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const currentPhase = inferPhase(messages)

  const patchWorkbench = useCallback(
    async (slotKey: string, data: unknown) => {
      const next = { ...workbenchState, [slotKey]: data }
      setWorkbenchState(next)
      try {
        await fetch(`/api/conversations/${conversation.id}/workbench`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        })
      } catch {
        // Non-critical; the next page load will re-read from server.
      }
    },
    [workbenchState, conversation.id],
  )

  useEffect(() => {
    fetch(`/api/student/${student.id}/selections`)
      .then((r) => r.json())
      .then(({ selections: loaded }: { selections: StudentSelection[] }) => setSelections(loaded))
      .catch(() => {/* Non-critical */})
  }, [student.id])

  async function toggleSelection(
    kind: StudentSelection['kind'],
    refId: string,
    refLabel: string,
  ) {
    const existing = selections.find((s) => s.kind === kind && s.refId === refId)
    if (existing) {
      await fetch(`/api/student/${student.id}/selections?id=${existing.id}`, { method: 'DELETE' })
      setSelections((prev) => prev.filter((s) => s.id !== existing.id))
    } else {
      const res = await fetch(`/api/student/${student.id}/selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, refId, refLabel }),
      })
      const { selection } = await res.json()
      setSelections((prev) => [selection, ...prev])
    }
  }

  const selectedUnitIds = useMemo(
    () => new Set(selections.filter((s) => s.kind === 'school').map((s) => s.refId)),
    [selections],
  )
  const selectedPathwayIds = useMemo(
    () => new Set(selections.filter((s) => s.kind === 'pathway').map((s) => s.refId)),
    [selections],
  )

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  async function sendMessage(text: string) {
    const userMsg: DisplayMessage = { role: 'user', content: text, timestamp: Date.now() }
    setMessages((p) => [...p, userMsg])
    setIsLoading(true)
    const assistantMsg: DisplayMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }
    setMessages((p) => [...p, assistantMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: conversation.id,
          studentId: student.id,
          personaId: student.personaId,
          profile,
          workbenchState,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages((p) => {
          const next = [...p]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: err.error ?? 'Something went wrong.',
            isStreaming: false,
          }
          return next
        })
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const clean = stripStructuredComponentForStream(accumulated)
        setMessages((p) => {
          const next = [...p]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: clean,
            isStreaming: true,
          }
          return next
        })
      }
      const { cleanText, component } = parseStructuredComponentMessage(accumulated)
      setMessages((p) => {
        const next = [...p]
        next[next.length - 1] = {
          ...next[next.length - 1],
          content: cleanText,
          structuredComponent: component ?? undefined,
          isStreaming: false,
        }
        return next
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function newConversation() {
    const res = await fetch(`/api/student/${student.id}/conversations`, { method: 'POST' })
    const { id } = await res.json()
    router.push(`/student/${student.id}/${id}`)
  }

  const phaseLabel = currentPhase[0].toUpperCase() + currentPhase.slice(1)
  const hasMessages = messages.length > 0
  const onlyOpener = messages.length <= 1 && (messages[0]?.role === 'assistant' || !hasMessages)

  const suggestions = [
    'What does my next year look like, step by step?',
    'Help me compare three schools I&apos;ve been thinking about.',
    'Walk me through FAFSA in plain language.',
    'What careers fit what I&apos;m already good at?',
  ]

  return (
    <div className="flex flex-row h-[calc(100vh-57px)]">
      <LeftRail
        student={student}
        conversations={conversations}
        activeConvId={conversation.id}
        onNew={newConversation}
        onShare={() => setShareOpen(true)}
        onExport={() => {
          window.location.href = `/api/student/${student.id}/export`
        }}
      />
      <main className="flex-1 flex flex-col overflow-hidden bg-paper relative">
        {/* Conversation header */}
        <div className="border-b border-rule px-8 py-4 bg-paper/60 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl flex items-baseline justify-between gap-4">
            <div>
              <div className="eyebrow-accent">Chapter · {phaseLabel}</div>
              <h2 className="font-display text-[26px] leading-tight text-ink mt-0.5">
                {conversation.title}
              </h2>
            </div>
            <div className="hidden sm:flex items-baseline gap-5 text-ink-soft">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider">entries</span>
                <span className="serif-numeral text-[20px] text-forest">
                  {messages.filter((m) => m.role === 'user').length
                    .toString()
                    .padStart(2, '0')}
                </span>
              </div>
              {selections.length > 0 && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-forest" style={{ fontSize: '9px', lineHeight: 1 }} aria-hidden>◆</span>
                  <span className="font-mono text-[11px] text-forest uppercase tracking-wider">
                    {selections.length} {selections.length === 1 ? 'selection' : 'selections'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-8 refined-scroll">
          <div className="mx-auto w-full max-w-3xl">
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                structuredComponent={renderStructuredComponent(
                  m.structuredComponent,
                  patchWorkbench,
                  `msg-${i}`,
                  selectedUnitIds,
                  selectedPathwayIds,
                  (school) => toggleSelection('school', school.unitId, school.name),
                  (pathway) => toggleSelection('pathway', pathway.title, pathway.title),
                )}
                citations={m.citations}
                rubricOverall={m.rubricOverall}
              />
            ))}
            {isLoading &&
              messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator />}
            <div ref={bottomRef} />

            {onlyOpener && (
              <div className="mt-10">
                <div className="rule-fancy mb-4"><span className="ornament">·  ·  ·</span></div>
                <div className="caps-sm mb-3 text-center">Or begin here</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 stagger">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s.replace(/&apos;/g, "'"))}
                      className="almanac-card text-left px-4 py-3 text-[14px] text-ink-mid hover:text-ink hover:border-forest hover:bg-forest-soft transition-all group"
                    >
                      <span className="font-display italic text-forest mr-2">›</span>
                      {s.replace(/&apos;/g, '’')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-5 pt-2 bg-paper border-t border-rule">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </main>
      <RightRail
        profile={profile}
        onProfileChange={setProfile}
        currentPhase={currentPhase}
        signals={
          [...messages].reverse().find((m) => m.role === 'assistant' && m.signals)?.signals
        }
        citations={[...messages]
          .reverse()
          .find((m) => m.role === 'assistant' && m.citations)
          ?.citations?.map((c) => ({ source: c.source }))}
      />
      {shareOpen && <ShareModal studentId={student.id} onClose={() => setShareOpen(false)} />}
    </div>
  )
}
