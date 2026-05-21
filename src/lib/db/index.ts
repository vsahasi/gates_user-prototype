// src/lib/db/index.ts
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

let _db: DatabaseSync | null = null
let _migrated = false

export function getDb(): DatabaseSync {
  if (_db && _db.isOpen) return _db
  const path = process.env.SQLITE_PATH ?? './data/pathwayai.db'
  try {
    mkdirSync(dirname(path), { recursive: true })
  } catch {
    /* directory may already exist */
  }
  _db = new DatabaseSync(path)
  _db.exec('PRAGMA journal_mode = WAL')
  _db.exec('PRAGMA foreign_keys = ON')
  _db.exec('PRAGMA busy_timeout = 5000')
  // Drain any leftover WAL from a previous process.
  try {
    _db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } catch {
    /* nothing to checkpoint */
  }
  return _db
}

export function closeDb(): void {
  if (_db && _db.isOpen) {
    try {
      _db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } catch {
      /* ignore */
    }
    _db.close()
    _db = null
  }
  _migrated = false
}

export function runMigrations(): void {
  if (_migrated) return
  const db = getDb()
  const dir = join(process.cwd(), 'db', 'migrations')
  if (!existsSync(dir)) {
    console.warn(`[db] migrations dir not found: ${dir}`)
    _migrated = true
    return
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8')
    db.exec(sql)
  }
  _migrated = true
}

export function transact<T>(fn: () => T): T {
  const db = getDb()
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    try {
      db.exec('ROLLBACK')
    } catch {
      /* already rolled back */
    }
    throw err
  }
}

export type { StatementSync }
