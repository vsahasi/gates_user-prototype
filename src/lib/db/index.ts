// src/lib/db/index.ts
//
// Async data layer with two interchangeable backends:
//   - node:sqlite (local file) — dev, tests, scripts, and the degraded
//     Vercel fallback (per-instance /tmp, ephemeral).
//   - @libsql/client (Turso) — when TURSO_DATABASE_URL is set. One hosted
//     database shared by every serverless function/instance, which is what
//     makes writes visible across routes on Vercel.
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createClient, type Client, type InValue } from '@libsql/client'

export type DbValue = null | number | string
export interface DbStatement {
  sql: string
  params?: DbValue[]
}

export interface DbAdapter {
  all<T>(sql: string, params?: DbValue[]): Promise<T[]>
  get<T>(sql: string, params?: DbValue[]): Promise<T | undefined>
  run(sql: string, params?: DbValue[]): Promise<void>
  /** Executes all statements in one transaction (all-or-nothing). */
  batch(stmts: DbStatement[]): Promise<void>
  /** Executes a multi-statement SQL script (migrations). */
  execMultiple(sql: string): Promise<void>
  close(): Promise<void>
}

// ---------------------------------------------------------------------------
// node:sqlite backend
// ---------------------------------------------------------------------------

// On Vercel the deployment bundle is read-only; /tmp is the only writable path.
function defaultPath(): string {
  return process.env.VERCEL ? '/tmp/pathwayai.db' : './data/pathwayai.db'
}

// First open on a fresh instance starts from the bundled demo snapshot so
// visitors land on seeded students instead of an empty database.
function seedIfMissing(path: string): void {
  if (existsSync(path)) return
  const seed =
    process.env.SQLITE_SEED_PATH ??
    (process.env.VERCEL ? join(process.cwd(), 'data', 'pathwayai.demo.db') : null)
  if (seed && existsSync(seed)) copyFileSync(seed, path)
}

// node:sqlite rows have null prototypes, which Next refuses to serialize
// across the server/client boundary — clone into plain objects here so every
// caller gets serializable rows regardless of backend.
function plainRow<T>(row: unknown): T {
  return { ...(row as Record<string, unknown>) } as T
}

class SqliteAdapter implements DbAdapter {
  private db: DatabaseSync

  constructor(path: string) {
    try {
      mkdirSync(dirname(path), { recursive: true })
    } catch {
      /* directory may already exist */
    }
    seedIfMissing(path)
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA foreign_keys = ON')
    this.db.exec('PRAGMA busy_timeout = 5000')
    // Drain any leftover WAL from a previous process.
    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } catch {
      /* nothing to checkpoint */
    }
  }

  get isOpen(): boolean {
    return this.db.isOpen
  }

  async all<T>(sql: string, params: DbValue[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params).map((r) => plainRow<T>(r))
  }

  async get<T>(sql: string, params: DbValue[] = []): Promise<T | undefined> {
    const row = this.db.prepare(sql).get(...params)
    return row === undefined ? undefined : plainRow<T>(row)
  }

  async run(sql: string, params: DbValue[] = []): Promise<void> {
    this.db.prepare(sql).run(...params)
  }

  async batch(stmts: DbStatement[]): Promise<void> {
    this.db.exec('BEGIN')
    try {
      for (const s of stmts) {
        this.db.prepare(s.sql).run(...(s.params ?? []))
      }
      this.db.exec('COMMIT')
    } catch (err) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        /* already rolled back */
      }
      throw err
    }
  }

  async execMultiple(sql: string): Promise<void> {
    this.db.exec(sql)
  }

  async close(): Promise<void> {
    if (this.db.isOpen) {
      try {
        this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      } catch {
        /* ignore */
      }
      this.db.close()
    }
  }
}

// ---------------------------------------------------------------------------
// libsql (Turso) backend
// ---------------------------------------------------------------------------

class LibsqlAdapter implements DbAdapter {
  private client: Client

  constructor(url: string, authToken?: string) {
    this.client = createClient({ url, authToken })
  }

  private static rows<T>(rs: { columns: string[]; rows: Record<string, unknown>[] }): T[] {
    // Normalize libsql Row proxies into plain serializable objects.
    return rs.rows.map((row) => {
      const o: Record<string, unknown> = {}
      for (const c of rs.columns) o[c] = row[c] ?? null
      return o as T
    })
  }

  async all<T>(sql: string, params: DbValue[] = []): Promise<T[]> {
    const rs = await this.client.execute({ sql, args: params as InValue[] })
    return LibsqlAdapter.rows<T>(rs as never)
  }

  async get<T>(sql: string, params: DbValue[] = []): Promise<T | undefined> {
    const rows = await this.all<T>(sql, params)
    return rows[0]
  }

  async run(sql: string, params: DbValue[] = []): Promise<void> {
    await this.client.execute({ sql, args: params as InValue[] })
  }

  async batch(stmts: DbStatement[]): Promise<void> {
    await this.client.batch(
      stmts.map((s) => ({ sql: s.sql, args: (s.params ?? []) as InValue[] })),
      'write',
    )
  }

  async execMultiple(sql: string): Promise<void> {
    // Turso manages journal mode / pragmas server-side; local-only PRAGMA
    // statements in migration scripts are not valid over the remote protocol.
    const cleaned = sql
      .split('\n')
      .filter((line) => !/^\s*PRAGMA\b/i.test(line))
      .join('\n')
    await this.client.executeMultiple(cleaned)
  }

  async close(): Promise<void> {
    this.client.close()
  }
}

// ---------------------------------------------------------------------------
// Singleton + migrations
// ---------------------------------------------------------------------------

let _db: DbAdapter | null = null
let _migrated = false

export function getDb(): DbAdapter {
  if (_db) {
    // A closed local handle must be reopened (tests close between cases).
    if (_db instanceof SqliteAdapter && !_db.isOpen) {
      _db = null
    } else {
      return _db
    }
  }
  const tursoUrl = process.env.TURSO_DATABASE_URL
  if (tursoUrl) {
    _db = new LibsqlAdapter(tursoUrl, process.env.TURSO_AUTH_TOKEN)
  } else {
    _db = new SqliteAdapter(process.env.SQLITE_PATH ?? defaultPath())
  }
  return _db
}

export async function closeDb(): Promise<void> {
  if (_db) {
    await _db.close()
    _db = null
  }
  _migrated = false
}

export async function runMigrations(): Promise<void> {
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
    await db.execMultiple(sql)
  }
  _migrated = true
}
