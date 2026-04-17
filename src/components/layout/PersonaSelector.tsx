'use client'
// src/components/layout/PersonaSelector.tsx
import { useRouter } from 'next/navigation'
import { PERSONAS } from '@/lib/data/personas'
import { Plus, Sparkles } from 'lucide-react'

const AVATAR_COLORS = [
  'from-teal-500 to-emerald-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-slate-500 to-gray-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-teal-600',
  'from-indigo-500 to-violet-600',
]

const SITUATION_STYLES: Record<string, { bg: string; text: string }> = {
  'First-Gen CC Transfer': { bg: 'bg-sky-50', text: 'text-sky-700' },
  'Unaccompanied Homeless Youth': { bg: 'bg-rose-50', text: 'text-rose-700' },
  'Teen Mother, Rural Virginia': { bg: 'bg-violet-50', text: 'text-violet-700' },
  'After Juvenile Detention': { bg: 'bg-amber-50', text: 'text-amber-700' },
  'Foster Youth Aging Out': { bg: 'bg-orange-50', text: 'text-orange-700' },
  'Navajo Nation, Rural First-Gen': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'Military Pathway to College': { bg: 'bg-slate-100', text: 'text-slate-700' },
  'Creative Arts / Animation': { bg: 'bg-pink-50', text: 'text-pink-700' },
  'Rural Appalachia, Nursing, Above Pell Threshold': { bg: 'bg-teal-50', text: 'text-teal-700' },
  'DACA-Eligible, Urban CA': { bg: 'bg-indigo-50', text: 'text-indigo-700' },
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function PersonaSelector() {
  const router = useRouter()

  function startWithPersona(personaId: string) {
    const sessionId = generateSessionId()
    router.push(`/chat/${sessionId}?persona=${personaId}`)
  }

  function startFresh() {
    const sessionId = generateSessionId()
    router.push(`/chat/${sessionId}`)
  }

  return (
    <div className="min-h-[calc(100vh-53px)] bg-gradient-to-br from-[#f0f7f5] via-[#fafaf8] to-[#f5f0eb]">
      {/* Hero section */}
      <div className="relative overflow-hidden">
        {/* Subtle background shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#1a6b5a]/[0.04] blur-3xl" />
          <div className="absolute top-32 -left-32 w-80 h-80 rounded-full bg-[#e07856]/[0.04] blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-72 h-72 rounded-full bg-[#5b8def]/[0.03] blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a6b5a]/8 text-[#1a6b5a] text-[13px] font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered College & Career Advising
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#1a1d23] mb-4 font-heading">
            Every pathway starts with
            <br />
            <span className="text-[#1a6b5a]">a conversation</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Explore your options, compare schools, navigate financial aid, and build a step-by-step plan — personalized to your situation.
          </p>
        </div>
      </div>

      {/* Persona grid */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Try a student scenario
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {PERSONAS.map((persona, i) => {
            const style = SITUATION_STYLES[persona.situation] ?? { bg: 'bg-gray-50', text: 'text-gray-700' }
            return (
              <button
                key={persona.id}
                onClick={() => startWithPersona(persona.id)}
                className="group text-left rounded-xl bg-white border border-border/50 p-5 transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.04] hover:-translate-y-0.5 hover:border-[#1a6b5a]/15 focus:outline-none focus:ring-2 focus:ring-[#1a6b5a]/20"
              >
                <div className="flex items-start gap-3.5">
                  {/* Avatar */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} text-white text-sm font-semibold shadow-sm`}
                  >
                    {getInitials(persona.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[15px] text-foreground">{persona.name}</span>
                      <span className="text-xs text-muted-foreground font-medium">Grade {persona.grade}</span>
                    </div>
                    <span
                      className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text} mb-2`}
                    >
                      {persona.situation}
                    </span>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{persona.goal}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1.5">{persona.state} · {persona.keyBarriers[0]}</p>
                  </div>
                </div>
              </button>
            )
          })}

          {/* Start Fresh card */}
          <button
            onClick={startFresh}
            className="group text-left rounded-xl border-2 border-dashed border-[#1a6b5a]/20 p-5 transition-all duration-200 hover:border-[#1a6b5a]/40 hover:bg-[#1a6b5a]/[0.02] focus:outline-none focus:ring-2 focus:ring-[#1a6b5a]/20"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[#1a6b5a]/25 text-[#1a6b5a]/50 group-hover:border-[#1a6b5a]/40 group-hover:text-[#1a6b5a]/70 transition-colors">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <span className="font-semibold text-[15px] text-foreground block mb-1">Start Fresh</span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enter your own information and get personalized guidance for your unique situation.
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
