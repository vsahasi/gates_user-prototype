// src/lib/db/index.ts
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

let _db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (_db && _db.isOpen) return _db
  const path = process.env.SQLITE_PATH ?? './data/pathwayai.db'
  _db = new DatabaseSync(path)
  _db.exec('PRAGMA journal_mode = WAL')
  _db.exec('PRAGMA foreign_keys = ON')
  return _db
}

export function closeDb(): void {
  if (_db && _db.isOpen) {
    _db.close()
    _db = null
  }
}

let _migrated = false

export function runMigrations(): void {
  if (_migrated) return
  const db = getDb()
  const dir = join(process.cwd(), 'db', 'migrations')
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
    db.exec('ROLLBACK')
    throw err
  }
}

export type { StatementSync }
