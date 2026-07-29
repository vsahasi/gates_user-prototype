// scripts/seed-demo.ts
import { runMigrations, closeDb } from '../src/lib/db'
import * as q from '../src/lib/db/queries'
import { DEFAULT_PROFILE } from '../src/lib/defaults'

async function main() {
  if (process.env.SEED_TARGET === 'turso') {
    // Seed the hosted Turso DB (TURSO_DATABASE_URL/TURSO_AUTH_TOKEN from env).
    if (!process.env.TURSO_DATABASE_URL) {
      throw new Error('SEED_TARGET=turso requires TURSO_DATABASE_URL')
    }
  } else {
    // Default: always seed the local demo snapshot, never the hosted DB —
    // this runs on every Vercel build and must not duplicate rows in Turso.
    delete process.env.TURSO_DATABASE_URL
    process.env.SQLITE_PATH = './data/pathwayai.demo.db'
  }
  await runMigrations()

  // Student A: mid-conversation, parent linked
  const sA = await q.createStudent({ displayName: 'Maria', personaId: 'mateo' })
  await q.upsertStudentProfile(sA.id, {
    ...DEFAULT_PROFILE,
    grade: 12,
    gpa: 3.6,
    interests: ['nursing', 'biology'],
    constraints: ['stay close to family'],
    goals: ['become a nurse practitioner'],
  })
  const convA = await q.createConversation(sA.id, 'Exploring nursing programs')
  await q.appendMessage({
    conversationId: convA.id,
    role: 'user',
    content: "I want to be a nurse but I don't know where to start",
  })
  await q.appendMessage({
    conversationId: convA.id,
    role: 'assistant',
    content: 'Got it — nursing has several pathways. Are you thinking 4-year BSN or starting with an associate degree (ADN) at a community college?',
  })

  const aMom = await q.createAdult({ displayName: "Maria's mom", kind: 'parent' })
  const tokA = await q.issueShareToken({
    studentId: sA.id,
    kind: 'parent',
    ttlMs: 30 * 24 * 60 * 60 * 1000,
  })
  await q.claimShareToken(tokA.token, aMom.id)

  // Student B: shared with counselor
  const sB = await q.createStudent({ displayName: 'Jamal', personaId: 'chloe' })
  await q.upsertStudentProfile(sB.id, {
    ...DEFAULT_PROFILE,
    grade: 11,
    gpa: 3.9,
    interests: ['computer science'],
    goals: ['get into a strong CS program'],
  })
  const aCounselor = await q.createAdult({ displayName: 'Ms. Patel', kind: 'counselor' })
  const tokB = await q.issueShareToken({
    studentId: sB.id,
    kind: 'counselor',
    ttlMs: 30 * 24 * 60 * 60 * 1000,
  })
  await q.claimShareToken(tokB.token, aCounselor.id)

  console.log(`Seeded demo db at ${process.env.SQLITE_PATH}`)
  console.log(`Student A id: ${sA.id} (mom: ${aMom.id})`)
  console.log(`Student B id: ${sB.id} (counselor: ${aCounselor.id})`)
  await closeDb()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
