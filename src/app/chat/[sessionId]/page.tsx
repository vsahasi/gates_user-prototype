// src/app/chat/[sessionId]/page.tsx
import { ChatInterface } from '@/components/chat/ChatInterface'
import { Header } from '@/components/layout/Header'
import { getPersonaById } from '@/lib/data/personas'

interface ChatPageProps {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ persona?: string }>
}

export default async function ChatPage({ params, searchParams }: ChatPageProps) {
  const { sessionId } = await params
  const { persona: personaId } = await searchParams
  const persona = personaId ? getPersonaById(personaId) : undefined

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header personaName={persona?.name} sessionId={sessionId} />
      <ChatInterface
        sessionId={sessionId}
        personaId={personaId}
        personaName={persona?.name}
      />
    </div>
  )
}
