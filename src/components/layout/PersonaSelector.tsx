'use client'
// src/components/layout/PersonaSelector.tsx
import { useRouter } from 'next/navigation'
import { PERSONAS } from '@/lib/data/personas'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const SITUATION_COLORS: Record<string, string> = {
  'First-Gen CC Transfer': 'bg-blue-100 text-blue-800',
  'Unaccompanied Homeless Youth': 'bg-red-100 text-red-800',
  'Teen Mother, Rural Virginia': 'bg-purple-100 text-purple-800',
  'After Juvenile Detention': 'bg-orange-100 text-orange-800',
  'Foster Youth Aging Out': 'bg-yellow-100 text-yellow-800',
  'Navajo Nation, Rural First-Gen': 'bg-green-100 text-green-800',
  'Military Pathway to College': 'bg-slate-100 text-slate-800',
  'Creative Arts / Animation': 'bg-pink-100 text-pink-800',
  'Rural Appalachia, Nursing, Above Pell Threshold': 'bg-teal-100 text-teal-800',
  'DACA-Eligible, Urban CA': 'bg-indigo-100 text-indigo-800',
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
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
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">College & Career Advisor</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Select a student persona to begin a demo session, or start fresh to enter your own information.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PERSONAS.map((persona) => (
          <Card
            key={persona.id}
            className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/30"
            onClick={() => startWithPersona(persona.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{persona.name}</CardTitle>
                <Badge variant="outline" className="text-xs shrink-0">Grade {persona.grade}</Badge>
              </div>
              <span
                className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${SITUATION_COLORS[persona.situation] ?? 'bg-gray-100 text-gray-800'}`}
              >
                {persona.situation}
              </span>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground line-clamp-2">{persona.goal}</p>
              <p className="text-xs text-muted-foreground">{persona.state} · {persona.keyBarriers[0]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center pt-4 border-t">
        <Button variant="outline" size="lg" onClick={startFresh}>
          Start Fresh (Enter My Own Info)
        </Button>
      </div>
    </div>
  )
}
