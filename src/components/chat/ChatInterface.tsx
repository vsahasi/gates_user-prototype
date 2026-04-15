'use client'
// src/components/chat/ChatInterface.tsx
import { useState, useRef, useEffect } from 'react'
import { MessageBubble, TypingIndicator } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { ComparisonTable } from '@/components/panels/ComparisonTable'
import { PathwayCards } from '@/components/panels/PathwayCards'
import { TimelineChecklist } from '@/components/panels/TimelineChecklist'
import type {
  Message,
  StructuredComponent,
  ComparisonTableData,
  PathwayCardsData,
  TimelineChecklistData,
  StudentProfile,
} from '@/lib/types'
import { SCHOOLS } from '@/lib/data/schools'
import { ProfilePanel } from '@/components/panels/ProfilePanel'

interface ChatInterfaceProps {
  sessionId: string
  personaId?: string
  personaName?: string
  initialProfile?: Partial<StudentProfile>
}

interface DisplayMessage extends Message {
  structuredComponent?: StructuredComponent
  isStreaming?: boolean
}

function parseStructuredComponent(text: string): { cleanText: string; component: StructuredComponent | null } {
  const match = text.match(/<!-- COMPONENT:(\w+) -->\n([\s\S]*?)\n<!-- \/COMPONENT -->/)
  if (!match) return { cleanText: text, component: null }

  const type = match[1] as StructuredComponent['type']
  try {
    const data = JSON.parse(match[2])
    return {
      cleanText: text.replace(match[0], '').trim(),
      component: { type, data },
    }
  } catch {
    return { cleanText: text, component: null }
  }
}

function renderStructuredComponent(component: StructuredComponent | undefined) {
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
  return null
}

const DEFAULT_PROFILE: StudentProfile = {
  grade: null,
  state: null,
  interests: [],
  gpa: null,
  financialInfo: { incomeRange: null, pellEligible: null, hasParentalSupport: null },
  constraints: [],
  specialCircumstances: [],
  goals: [],
  programInterests: [],
}

export function mergeProfile(initial: Partial<StudentProfile>): StudentProfile {
  return {
    ...DEFAULT_PROFILE,
    ...initial,
    financialInfo: { ...DEFAULT_PROFILE.financialInfo, ...(initial.financialInfo ?? {}) },
  }
}

export function ChatInterface({ sessionId, personaId, personaName, initialProfile = {} }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState<StudentProfile>(() => mergeProfile(initialProfile))
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const greeting: DisplayMessage = {
      role: 'assistant',
      content: personaName
        ? `Hi! I'm your college and career advisor. I can see you're exploring options as ${personaName}. What questions do you have? You can ask me about pathways, schools, financial aid, applications — anything.`
        : "Hi! I'm your college and career advisor. To get started, can you tell me a bit about yourself? What grade are you in, and what are you hoping to explore today?",
      timestamp: Date.now(),
    }
    setMessages([greeting])
  }, [personaName])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    const userMsg: DisplayMessage = { role: 'user', content: text, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    const assistantMsg: DisplayMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, personaId }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: err.error ?? 'Something went wrong. Please try again.',
            isStreaming: false,
          }
          return updated
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
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: accumulated,
            isStreaming: true,
          }
          return updated
        })
      }

      const { cleanText, component } = parseStructuredComponent(accumulated)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: cleanText,
          structuredComponent: component ?? undefined,
          isStreaming: false,
        }
        return updated
      })
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Connection error. Please check your internet and try again.',
          isStreaming: false,
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl mx-auto w-full">
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            structuredComponent={renderStructuredComponent(msg.structuredComponent)}
          />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
      <div className="max-w-3xl mx-auto w-full">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  )
}
