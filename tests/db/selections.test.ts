// tests/db/selections.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unlinkSync, existsSync } from 'node:fs'
import { closeDb, runMigrations } from '@/lib/db'
import * as q from '@/lib/db/queries'

const TEST_DB = './data/test-selections.db'

beforeEach(async () => {
  await closeDb()
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  process.env.SQLITE_PATH = TEST_DB
  await runMigrations()
})

afterEach(async () => {
  await closeDb()
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
})

describe('createSelection', () => {
  it('creates a row with the correct fields', async () => {
    const student = await q.createStudent({ displayName: 'Alice' })
    const sel = await q.createSelection({
      studentId: student.id,
      kind: 'school',
      refId: 'uw-seattle',
      refLabel: 'University of Washington',
      note: 'Great CS program',
      stance: 'considering',
    })

    expect(sel.id).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(sel.studentId).toBe(student.id)
    expect(sel.kind).toBe('school')
    expect(sel.refId).toBe('uw-seattle')
    expect(sel.refLabel).toBe('University of Washington')
    expect(sel.note).toBe('Great CS program')
    expect(sel.stance).toBe('considering')
    expect(typeof sel.createdAt).toBe('number')
    expect(sel.createdAt).toBeGreaterThan(0)
  })

  it('defaults stance to "considering" when not provided', async () => {
    const student = await q.createStudent({ displayName: 'Bob' })
    const sel = await q.createSelection({
      studentId: student.id,
      kind: 'pathway',
      refId: 'stem',
      refLabel: 'STEM Pathway',
    })
    expect(sel.stance).toBe('considering')
    expect(sel.note).toBeNull()
  })
})

describe('createSelection upsert behavior', () => {
  it('updates the existing row on duplicate (studentId, kind, refId) rather than throwing', async () => {
    const student = await q.createStudent({ displayName: 'Carol' })
    const first = await q.createSelection({
      studentId: student.id,
      kind: 'school',
      refId: 'mit',
      refLabel: 'MIT',
      stance: 'considering',
    })

    // Same (studentId, kind, refId) — should update, not throw
    const second = await q.createSelection({
      studentId: student.id,
      kind: 'school',
      refId: 'mit',
      refLabel: 'Massachusetts Institute of Technology',
      note: 'Updated note',
      stance: 'leaning',
    })

    // Same underlying row id
    expect(second.id).toBe(first.id)
    expect(second.refLabel).toBe('Massachusetts Institute of Technology')
    expect(second.note).toBe('Updated note')
    expect(second.stance).toBe('leaning')
  })

  it('listSelections returns only one row for the upserted pair', async () => {
    const student = await q.createStudent({ displayName: 'Dave' })
    await q.createSelection({ studentId: student.id, kind: 'career', refId: 'eng', refLabel: 'Engineer' })
    await q.createSelection({ studentId: student.id, kind: 'career', refId: 'eng', refLabel: 'Software Engineer', stance: 'leaning' })

    const list = await q.listSelections(student.id)
    expect(list.length).toBe(1)
    expect(list[0].refLabel).toBe('Software Engineer')
    expect(list[0].stance).toBe('leaning')
  })
})

describe('listSelections', () => {
  it('returns rows ordered by createdAt DESC', async () => {
    const student = await q.createStudent({ displayName: 'Eve' })
    const s1 = await q.createSelection({ studentId: student.id, kind: 'school', refId: 'a', refLabel: 'A' })
    // Ensure different timestamps
    await new Promise((r) => setTimeout(r, 5))
    const s2 = await q.createSelection({ studentId: student.id, kind: 'school', refId: 'b', refLabel: 'B' })

    const list = await q.listSelections(student.id)
    expect(list.map((s) => s.id)).toEqual([s2.id, s1.id])
  })

  it('returns only selections belonging to the requested student', async () => {
    const s1 = await q.createStudent({ displayName: 'Frank' })
    const s2 = await q.createStudent({ displayName: 'Grace' })
    await q.createSelection({ studentId: s1.id, kind: 'major', refId: 'cs', refLabel: 'Computer Science' })
    await q.createSelection({ studentId: s2.id, kind: 'major', refId: 'bio', refLabel: 'Biology' })

    const list1 = await q.listSelections(s1.id)
    expect(list1.length).toBe(1)
    expect(list1[0].refId).toBe('cs')

    const list2 = await q.listSelections(s2.id)
    expect(list2.length).toBe(1)
    expect(list2[0].refId).toBe('bio')
  })
})

describe('updateSelectionStance and removeSelection', () => {
  it('updateSelectionStance flips the stance', async () => {
    const student = await q.createStudent({ displayName: 'Hank' })
    const sel = await q.createSelection({
      studentId: student.id,
      kind: 'school',
      refId: 'stanford',
      refLabel: 'Stanford',
      stance: 'considering',
    })

    await q.updateSelectionStance(sel.id, 'committed')
    const updated = await q.getSelection(sel.id)
    expect(updated?.stance).toBe('committed')
  })

  it('removeSelection deletes the row', async () => {
    const student = await q.createStudent({ displayName: 'Iris' })
    const sel = await q.createSelection({
      studentId: student.id,
      kind: 'pathway',
      refId: 'health',
      refLabel: 'Health Sciences',
    })

    expect(await q.getSelection(sel.id)).toBeDefined()
    await q.removeSelection(sel.id)
    expect(await q.getSelection(sel.id)).toBeUndefined()

    const list = await q.listSelections(student.id)
    expect(list.length).toBe(0)
  })
})
