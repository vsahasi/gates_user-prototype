// tests/db/connection.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unlinkSync, existsSync } from 'node:fs'
import { getDb, closeDb, runMigrations } from '@/lib/db'

const TEST_DB = './data/test.db'

describe('db connection', () => {
  beforeEach(async () => {
    await closeDb()
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
    process.env.SQLITE_PATH = TEST_DB
  })
  afterEach(async () => {
    await closeDb()
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB)
  })

  it('opens a SQLite db at SQLITE_PATH', async () => {
    const row = await getDb().get<{ ok: number }>('SELECT 1 AS ok')
    expect(row?.ok).toBe(1)
    expect(existsSync(TEST_DB)).toBe(true)
  })

  it('runMigrations applies 0001_init', async () => {
    await runMigrations()
    const tables = await getDb().all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    const names = tables.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'students', 'adults', 'student_profiles', 'links',
        'conversations', 'messages', 'adult_conversations',
        'adult_messages', 'trust_events', 'share_tokens', 'eval_runs',
      ])
    )
  })

  it('foreign keys are enforced', async () => {
    await runMigrations()
    await expect(
      getDb().run(
        `INSERT INTO student_profiles (studentId, profileJson, updatedAt) VALUES (?, ?, ?)`,
        ['nonexistent', '{}', Date.now()]
      )
    ).rejects.toThrow(/FOREIGN KEY/i)
  })
})
