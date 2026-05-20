// src/app/student/[studentId]/[conversationId]/page.tsx
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Workbench } from '@/components/workbench/Workbench'
import {
  getStudent,
  getStudentProfile,
  getConversation,
  listConversations,
  listMessages,
} from '@/lib/db/queries'

export default async function StudentConv({
  params,
}: {
  params: Promise<{ studentId: string; conversationId: string }>
}) {
  const { studentId, conversationId } = await params
  const student = getStudent(studentId)
  const conv = getConversation(conversationId)
  if (!student || !conv || conv.studentId !== studentId) redirect('/')

  const profile = getStudentProfile(studentId)!
  const conversations = listConversations(studentId)
  const messages = listMessages(conversationId)

  return (
    <div className="min-h-screen bg-background">
      <Header personaName={student.displayName} sessionId={conversationId} />
      <Workbench
        student={student}
        profile={profile}
        conversation={conv}
        conversations={conversations}
        messages={messages}
      />
    </div>
  )
}
