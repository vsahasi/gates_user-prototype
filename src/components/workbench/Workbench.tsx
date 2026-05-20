// src/components/workbench/Workbench.tsx
'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
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
import type { Student, Conversation, DbMessage } from '@/lib/db/queries'

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
) {
  if (!component) return null
  if (component.type === 'comparison_table') {
    const data = component.data as ComparisonTableData
    const schools = (data.schools as unknown as string[])
      .map((id) => SCHOOLS.find((s) => s.unitId === id))
      .filter(Boolean) as typeof SCHOOLS
    return <ComparisonTable schools={schools} fields={data.fields} labels={data.labels} />
  }
  if (component.type === 'pathway_cards') {
    return <PathwayCards data={component.data as PathwayCardsData} />
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

  return (
    <div className="flex flex-row h-[calc(100vh-53px)]">
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
      <main className="flex-1 flex flex-col overflow-hidden bg-[#fafaf8]">
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 refined-scroll">
          <div className="mx-auto w-full max-w-3xl space-y-1">
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                structuredComponent={renderStructuredComponent(
                  m.structuredComponent,
                  patchWorkbench,
                  `msg-${i}`,
                )}
                citations={m.citations}
                rubricOverall={m.rubricOverall}
              />
            ))}
            {isLoading &&
              messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </div>
        <div className="px-4 pb-4 sm:px-6">
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
