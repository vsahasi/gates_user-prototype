// tests/db/selections.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unlinkSync, existsSync } from 'node:fs'
import { closeDb, runMigrations } from '@/lib/db'
import * as q from '@/lib/db/queries'

const TEST_DB = './data/test-selections.db'

beforeEach(() => {
  closeDb()
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  process.env.SQLITE_PATH = TEST_DB
  runMigrations()
})

afterEach(() => {
  closeDb()
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
})

describe('createSelection', () => {
  it('creates a row with the correct fields', () => {
    const student = q.createStudent({ displayName: 'Alice' })
    const sel = q.createSelection({
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

  it('defaults stance to "considering" when not provided', () => {
    const student = q.createStudent({ displayName: 'Bob' })
    const sel = q.createSelection({
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
  it('updates the existing row on duplicate (studentId, kind, refId) rather than throwing', () => {
    const student = q.createStudent({ displayName: 'Carol' })
    const first = q.createSelection({
      studentId: student.id,
      kind: 'school',
      refId: 'mit',
      refLabel: 'MIT',
      stance: 'considering',
    })

    // Same (studentId, kind, refId) — should update, not throw
    const second = q.createSelection({
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

  it('listSelections returns only one row for the upserted pair', () => {
    const student = q.createStudent({ displayName: 'Dave' })
    q.createSelection({ studentId: student.id, kind: 'career', refId: 'eng', refLabel: 'Engineer' })
    q.createSelection({ studentId: student.id, kind: 'career', refId: 'eng', refLabel: 'Software Engineer', stance: 'leaning' })

    const list = q.listSelections(student.id)
    expect(list.length).toBe(1)
    expect(list[0].refLabel).toBe('Software Engineer')
    expect(list[0].stance).toBe('leaning')
  })
})

describe('listSelections', () => {
  it('returns rows ordered by createdAt DESC', async () => {
    const student = q.createStudent({ displayName: 'Eve' })
    const s1 = q.createSelection({ studentId: student.id, kind: 'school', refId: 'a', refLabel: 'A' })
    // Ensure different timestamps
    await new Promise((r) => setTimeout(r, 5))
    const s2 = q.createSelection({ studentId: student.id, kind: 'school', refId: 'b', refLabel: 'B' })

    const list = q.listSelections(student.id)
    expect(list.map((s) => s.id)).toEqual([s2.id, s1.id])
  })

  it('returns only selections belonging to the requested student', () => {
    const s1 = q.createStudent({ displayName: 'Frank' })
    const s2 = q.createStudent({ displayName: 'Grace' })
    q.createSelection({ studentId: s1.id, kind: 'major', refId: 'cs', refLabel: 'Computer Science' })
    q.createSelection({ studentId: s2.id, kind: 'major', refId: 'bio', refLabel: 'Biology' })

    const list1 = q.listSelections(s1.id)
    expect(list1.length).toBe(1)
    expect(list1[0].refId).toBe('cs')

    const list2 = q.listSelections(s2.id)
    expect(list2.length).toBe(1)
    expect(list2[0].refId).toBe('bio')
  })
})

describe('updateSelectionStance and removeSelection', () => {
  it('updateSelectionStance flips the stance', () => {
    const student = q.createStudent({ displayName: 'Hank' })
    const sel = q.createSelection({
      studentId: student.id,
      kind: 'school',
      refId: 'stanford',
      refLabel: 'Stanford',
      stance: 'considering',
    })

    q.updateSelectionStance(sel.id, 'committed')
    const updated = q.getSelection(sel.id)
    expect(updated?.stance).toBe('committed')
  })

  it('removeSelection deletes the row', () => {
    const student = q.createStudent({ displayName: 'Iris' })
    const sel = q.createSelection({
      studentId: student.id,
      kind: 'pathway',
      refId: 'health',
      refLabel: 'Health Sciences',
    })

    expect(q.getSelection(sel.id)).toBeDefined()
    q.removeSelection(sel.id)
    expect(q.getSelection(sel.id)).toBeUndefined()

    const list = q.listSelections(student.id)
    expect(list.length).toBe(0)
  })
})
