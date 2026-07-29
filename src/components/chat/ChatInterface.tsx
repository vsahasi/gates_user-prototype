'use client'
// src/components/chat/ChatInterface.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageBubble, TypingIndicator } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { ComparisonTable } from '@/components/panels/ComparisonTable'
import { PathwayCards } from '@/components/panels/PathwayCards'
import { TimelineChecklist } from '@/components/panels/TimelineChecklist'
import { ProfilePanel } from '@/components/panels/ProfilePanel'
import { JourneyPhase } from '@/components/panels/JourneyPhase'
import type {
  Message,
  StructuredComponent,
  ComparisonTableData,
  PathwayCardsData,
  TimelineChecklistData,
  StudentProfile,
} from '@/lib/types'
import { SCHOOLS } from '@/lib/data/schools'
import { DEFAULT_PROFILE } from '@/lib/defaults'
import {
  parseStructuredComponentMessage,
  stripStructuredComponentForStream,
} from '@/lib/chat/structured-component'
import { PanelLeftClose, PanelLeft } from 'lucide-react'

interface ChatInterfaceProps {
  sessionId: string
  personaId?: string
  personaName?: string
  initialProfile?: Partial<StudentProfile>
  studentId?: string
}

interface DisplayMessage extends Message {
  structuredComponent?: StructuredComponent
  isStreaming?: boolean
}

type Phase = 'exploration' | 'preparation' | 'decision' | 'application' | 'transition'

const PHASES: { id: Phase; label: string }[] = [
  { id: 'exploration', label: 'Exploration' },
  { id: 'preparation', label: 'Preparation' },
  { id: 'decision', label: 'Decision' },
  { id: 'application', label: 'Application' },
  { id: 'transition', label: 'Transition' },
]

function inferPhase(messages: DisplayMessage[]): Phase {
  const messageCount = messages.filter((m) => m.role === 'user').length
  if (messageCount <= 2) return 'exploration'
  if (messageCount <= 5) return 'preparation'
  if (messageCount <= 8) return 'decision'
  if (messageCount <= 12) return 'application'
  return 'transition'
}

function getPromptChips(phase: Phase): string[] {
  switch (phase) {
    case 'exploration':
      return [
        'What are my options after high school?',
        'Help me explore career paths',
        'What schools match my interests?',
        "I'm not sure what I want to do",
      ]
    case 'preparation':
      return [
        'Help me with FAFSA',
        'Compare my top school choices',
        'What are the deadlines I need to know?',
        'How do I build a strong application?',
      ]
    case 'decision':
      return [
        'Compare financial aid packages',
        'Which pathway fits my budget?',
        'What if my first choice doesn\'t work out?',
        'Help me decide between options',
      ]
    case 'application':
      return [
        'Create my application timeline',
        'Review my application checklist',
        'Help me write my personal statement',
        'What scholarships should I apply to?',
      ]
    case 'transition':
      return [
        'What do I need before classes start?',
        'Help me plan my first semester',
        'What support services are available?',
        'How do I prepare for orientation?',
      ]
  }
}

function renderStructuredComponent(component: StructuredComponent | undefined) {
  if (!component) return null
  if (component.type === 'comparison_table') {
    const data = component.data as ComparisonTableData
    if (!Array.isArray(data.schools)) return null
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

export function ChatInterface({ sessionId, personaId, personaName, initialProfile = {}, studentId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState<StudentProfile>(() => mergeProfile(initialProfile))
  // Sidebar default: open on md+ (desktop/tablet), closed on mobile so it
  // doesn't cover the chat. Initialized after mount to avoid SSR mismatch.
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const currentPhase = inferPhase(messages)
  const promptChips = getPromptChips(currentPhase)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setSidebarOpen(true)
    }
  }, [])

  useEffect(() => {
    const greeting: DisplayMessage = {
      role: 'assistant',
      content: personaName
        ? `Hi ${personaName}! I'm here to help you navigate your path forward. I can see some of your background already — let's build on that. What's on your mind today?`
        : "Hey there! I'm your college and career advisor. I'm here to help you figure out your next steps — whether that's exploring careers, finding schools, navigating financial aid, or building an action plan. To give you the best guidance, tell me a bit about yourself. What grade are you in, and what's been on your mind lately?",
      timestamp: Date.now(),
    }
    setMessages([greeting])
  }, [personaName])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

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
        body: JSON.stringify({ message: text, sessionId, personaId, profile, studentId }),
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

  const hasUserMessages = messages.some((m) => m.role === 'user')
  const lastMessage = messages[messages.length - 1]
  const showTypingIndicator =
    lastMessage?.role === 'assistant' && !!lastMessage.isStreaming && !lastMessage.content

  return (
    // Use dvh on mobile so the layout adapts when browser chrome shows/hides.
    // Falls back to vh on browsers that don't support dvh.
    <div className="relative flex flex-row h-[calc(100vh-53px)] h-[calc(100dvh-53px)]">
      {/* Mobile backdrop — visible only when sidebar is open on small screens. */}
      {sidebarOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 top-[53px] z-30 bg-black/30 backdrop-blur-[2px] animate-fade-in"
        />
      )}

      {/* Sidebar
          - mobile: fixed overlay, slides in from left, full-height under the header
          - md+:    inline column, collapses to width 0 when closed */}
      <aside
        className={`sidebar-transition shrink-0 border-r border-border/60 bg-[#f5f5f2] flex flex-col overflow-hidden
          fixed md:relative top-[53px] md:top-auto bottom-0 md:bottom-auto left-0 z-40 md:z-auto
          w-[85vw] max-w-[320px] md:w-[300px] md:max-w-none
          ${sidebarOpen ? 'translate-x-0 md:w-[300px]' : '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0'}`}
      >
        <div className="flex-1 overflow-y-auto refined-scroll p-4 space-y-4">
          {/* Profile card */}
          <div className="rounded-xl bg-white border border-border/60 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-r from-[#1a6b5a]/5 to-transparent">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1a6b5a]">
                Your Profile
              </h3>
            </div>
            <ProfilePanel profile={profile} onUpdate={setProfile} />
          </div>

          {/* Journey phase card */}
          <div className="rounded-xl bg-white border border-border/60 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your Journey
              </h3>
            </div>
            <JourneyPhase phases={PHASES} currentPhase={currentPhase} />
          </div>
        </div>
      </aside>

      {/* Sidebar toggle — anchored to viewport on mobile (sidebar is an overlay),
          to the layout-flow edge on md+. */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        className="fixed md:absolute top-1/2 -translate-y-1/2 z-50 md:z-40 flex h-10 md:h-8 w-7 md:w-5 items-center justify-center rounded-r-md border border-l-0 border-border/60 bg-white/95 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-white transition-all shadow-sm"
        style={{ left: sidebarOpen ? 'min(85vw, 320px)' : '0px', transition: 'left 0.3s ease' }}
      >
        {sidebarOpen ? <PanelLeftClose className="h-4 w-4 md:h-3.5 md:w-3.5" /> : <PanelLeft className="h-4 w-4 md:h-3.5 md:w-3.5" />}
      </button>

      {/* Chat column */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#fafaf8] min-w-0">
        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 refined-scroll">
          <div className="mx-auto w-full max-w-3xl space-y-1">
            {messages.map((msg, i) => (
              <div key={i} className="animate-message-in" style={{ animationDelay: `${Math.min(i * 50, 200)}ms` }}>
                <MessageBubble
                  message={msg}
                  structuredComponent={renderStructuredComponent(msg.structuredComponent)}
                />
              </div>
            ))}
            {showTypingIndicator && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Prompt chips + input. pb honors iOS safe area when keyboard hidden. */}
        <div className="px-3 pb-3 sm:px-6 sm:pb-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {/* Suggested prompts — show when few messages */}
          {!hasUserMessages && (
            <div className="mx-auto max-w-3xl mb-3 flex flex-wrap gap-2 animate-fade-in">
              {promptChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  disabled={isLoading}
                  className="prompt-chip text-[12px] sm:text-[13px] font-medium px-3 sm:px-3.5 py-2 rounded-full border border-[#1a6b5a]/20 bg-white text-[#1a6b5a] hover:bg-[#1a6b5a]/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  )
}
