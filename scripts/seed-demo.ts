// scripts/seed-demo.ts
import { runMigrations, closeDb } from '../src/lib/db'
import * as q from '../src/lib/db/queries'
import { DEFAULT_PROFILE } from '../src/lib/defaults'

async function main() {
  process.env.SQLITE_PATH = './data/pathwayai.demo.db'
  runMigrations()

  // Student A: mid-conversation, parent linked
  const sA = q.createStudent({ displayName: 'Maria', personaId: 'mateo' })
  q.upsertStudentProfile(sA.id, {
    ...DEFAULT_PROFILE,
    grade: 12,
    gpa: 3.6,
    interests: ['nursing', 'biology'],
    constraints: ['stay close to family'],
    goals: ['become a nurse practitioner'],
  })
  const convA = q.createConversation(sA.id, 'Exploring nursing programs')
  q.appendMessage({
    conversationId: convA.id,
    role: 'user',
    content: "I want to be a nurse but I don't know where to start",
  })
  q.appendMessage({
    conversationId: convA.id,
    role: 'assistant',
    content: 'Got it — nursing has several pathways. Are you thinking 4-year BSN or starting with an associate degree (ADN) at a community college?',
  })

  const aMom = q.createAdult({ displayName: "Maria's mom", kind: 'parent' })
  const tokA = q.issueShareToken({
    studentId: sA.id,
    kind: 'parent',
    ttlMs: 30 * 24 * 60 * 60 * 1000,
  })
  q.claimShareToken(tokA.token, aMom.id)

  // Student B: shared with counselor
  const sB = q.createStudent({ displayName: 'Jamal', personaId: 'chloe' })
  q.upsertStudentProfile(sB.id, {
    ...DEFAULT_PROFILE,
    grade: 11,
    gpa: 3.9,
    interests: ['computer science'],
    goals: ['get into a strong CS program'],
  })
  const aCounselor = q.createAdult({ displayName: 'Ms. Patel', kind: 'counselor' })
  const tokB = q.issueShareToken({
    studentId: sB.id,
    kind: 'counselor',
    ttlMs: 30 * 24 * 60 * 60 * 1000,
  })
  q.claimShareToken(tokB.token, aCounselor.id)

  console.log(`Seeded demo db at ${process.env.SQLITE_PATH}`)
  console.log(`Student A id: ${sA.id} (mom: ${aMom.id})`)
  console.log(`Student B id: ${sB.id} (counselor: ${aCounselor.id})`)
  closeDb()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
