// src/app/student/[studentId]/page.tsx
import { redirect } from 'next/navigation'
import {
  getStudent,
  listConversations,
  createConversation,
} from '@/lib/db/queries'
import { runMigrations } from '@/lib/db'

export default async function StudentEntry({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  await runMigrations()
  const { studentId } = await params
  const s = await getStudent(studentId)
  if (!s) redirect('/')
  const convs = await listConversations(studentId)
  const target = convs[0] ?? await createConversation(studentId, 'First conversation')
  redirect(`/student/${studentId}/${target.id}`)
}
