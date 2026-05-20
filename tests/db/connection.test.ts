// tests/db/connection.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unlinkSync, existsSync } from 'node:fs'
import { getDb, closeDb, runMigrations } from '@/lib/db'

const TEST_DB = './data/test.db'

describe('db connection', () => {
  beforeEach(() => {
    closeDb()
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
    process.env.SQLITE_PATH = TEST_DB
  })
  afterEach(() => {
    closeDb()
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  })

  it('opens a SQLite db at SQLITE_PATH', () => {
    const db = getDb()
    expect(db.isOpen).toBe(true)
  })

  it('runMigrations applies 0001_init', () => {
    runMigrations()
    const db = getDb()
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>
    const names = tables.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'students', 'adults', 'student_profiles', 'links',
        'conversations', 'messages', 'adult_conversations',
        'adult_messages', 'trust_events', 'share_tokens', 'eval_runs',
      ])
    )
  })

  it('foreign keys are enforced', () => {
    runMigrations()
    const db = getDb()
    expect(() =>
      db.prepare(
        `INSERT INTO student_profiles (studentId, profileJson, updatedAt) VALUES (?, ?, ?)`
      ).run('nonexistent', '{}', Date.now())
    ).toThrow(/FOREIGN KEY/i)
  })
})
