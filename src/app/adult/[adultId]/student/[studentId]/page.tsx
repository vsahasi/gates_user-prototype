// src/app/adult/[adultId]/student/[studentId]/page.tsx
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import {
  getAdult,
  getStudent,
  listLinksForAdult,
  getOrCreateAdultConversation,
  listAdultMessages,
} from '@/lib/db/queries'
import { runMigrations } from '@/lib/db'
import { getPinnedSummary } from '@/lib/orchestration/pinned-summary'
import { AdultWorkspace } from '@/components/adult/AdultWorkspace'

export default async function AdultStudent({
  params,
}: {
  params: Promise<{ adultId: string; studentId: string }>
}) {
  await runMigrations()
  const { adultId, studentId } = await params
  const adult = await getAdult(adultId)
  const student = await getStudent(studentId)
  if (!adult || !student) redirect('/')
  const links = await listLinksForAdult(adultId)
  if (!links.some((l) => l.studentId === studentId)) redirect(`/adult/${adultId}`)
  const summary = (await getPinnedSummary(studentId))!

  // Eagerly create the adult↔student conversation row so the first POST has
  // a stable ID and so we can prefetch any prior history.
  const conv = await getOrCreateAdultConversation(adultId, studentId)
  const priorMessages = await listAdultMessages(conv.id)

  return (
    <div className="min-h-screen bg-paper">
      <Header personaName={adult.displayName} />
      <AdultWorkspace
        adult={adult}
        student={student}
        summary={summary}
        initialMessages={priorMessages}
      />
    </div>
  )
}
