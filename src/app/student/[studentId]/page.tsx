// src/app/student/[studentId]/page.tsx
import { redirect } from 'next/navigation'
import {
  getStudent,
  listConversations,
  createConversation,
} from '@/lib/db/queries'

export default async function StudentEntry({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  const s = getStudent(studentId)
  if (!s) redirect('/')
  const convs = listConversations(studentId)
  const target = convs[0] ?? createConversation(studentId, 'First conversation')
  redirect(`/student/${studentId}/${target.id}`)
}
