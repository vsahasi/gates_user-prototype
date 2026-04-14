// src/app/page.tsx
import { PersonaSelector } from '@/components/layout/PersonaSelector'
import { Header } from '@/components/layout/Header'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <PersonaSelector />
      </main>
    </div>
  )
}
