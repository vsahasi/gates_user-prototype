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
import { DEFAULT_PROFILE } from '@/lib/defaults'
import {
  parseStructuredComponentMessage,
  stripStructuredComponentForStream,
} from '@/lib/chat/structured-component'

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
        body: JSON.stringify({ message: text, sessionId, personaId, profile }),
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
        const cleanStreamingText = stripStructuredComponentForStream(accumulated)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: cleanStreamingText,
            isStreaming: true,
          }
          return updated
        })
      }

      const { cleanText, component } = parseStructuredComponentMessage(accumulated)
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
    <div className="flex h-[calc(100vh-57px)] flex-row bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.08),_transparent_45%)]">
      {/* Profile sidebar */}
      <div className="w-[280px] shrink-0 border-r flex flex-col">
        <ProfilePanel profile={profile} onUpdate={setProfile} />
      </div>

      {/* Chat column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-3xl space-y-1">
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
        </div>
        <div className="px-4 pb-5 sm:px-6">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  )
}
