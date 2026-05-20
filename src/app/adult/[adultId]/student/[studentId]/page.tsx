// src/app/adult/[adultId]/student/[studentId]/page.tsx
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { getAdult, getStudent, listLinksForAdult } from '@/lib/db/queries'
import { getPinnedSummary } from '@/lib/orchestration/pinned-summary'
import { AdultWorkspace } from '@/components/adult/AdultWorkspace'

export default async function AdultStudent({
  params,
}: {
  params: Promise<{ adultId: string; studentId: string }>
}) {
  const { adultId, studentId } = await params
  const adult = getAdult(adultId)
  const student = getStudent(studentId)
  if (!adult || !student) redirect('/')
  const links = listLinksForAdult(adultId)
  if (!links.some((l) => l.studentId === studentId)) redirect(`/adult/${adultId}`)
  const summary = getPinnedSummary(studentId)!
  return (
    <div className="min-h-screen bg-background">
      <Header personaName={adult.displayName} />
      <AdultWorkspace adult={adult} student={student} summary={summary} />
    </div>
  )
}
