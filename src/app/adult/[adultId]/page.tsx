// src/app/adult/[adultId]/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { getAdult, listLinksForAdult, getStudent } from '@/lib/db/queries'

export default async function AdultHome({
  params,
}: {
  params: Promise<{ adultId: string }>
}) {
  const { adultId } = await params
  const a = getAdult(adultId)
  if (!a) redirect('/')
  const links = listLinksForAdult(adultId)
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 sm:px-6 py-10 max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-semibold">Hi {a.displayName}</h1>
        <p className="text-sm text-muted-foreground">
          Students who have shared their context with you:
        </p>
        {links.length === 0 ? (
          <p className="text-sm">No active shares yet.</p>
        ) : (
          <div className="space-y-2">
            {links.map((l) => {
              const s = getStudent(l.studentId)
              if (!s) return null
              return (
                <Link
                  key={l.id}
                  href={`/adult/${adultId}/student/${s.id}`}
                  className="block p-4 rounded-xl border border-border/60 bg-white hover:border-[#1a6b5a]/50"
                >
                  <div className="font-medium">{s.displayName}</div>
                  <div className="text-xs text-muted-foreground">linked as {l.role}</div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
