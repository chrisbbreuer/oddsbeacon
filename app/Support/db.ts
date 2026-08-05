import process from 'node:process'
import { db as stacksDb } from '@stacksjs/database'

interface SqlStatement {
  execute: () => Promise<unknown>
}

interface SqlExecutor {
  unsafe: (query: string, params?: unknown[]) => SqlStatement
  transaction?: <T>(fn: (transaction: SqlExecutor) => Promise<T> | T) => Promise<T>
  updateOrInsert?: (table: string, match: Record<string, unknown>, values: Record<string, unknown>) => Promise<unknown>
  insertOrIgnore?: (table: string, values: Record<string, unknown>) => Promise<unknown>
}

export interface RunResult {
  changes: number
  lastInsertRowid: number
}

function parameters(values: unknown[]): unknown[] {
  return values.length === 1 && Array.isArray(values[0]) ? values[0] : values
}

function portableSql(sql: string): string {
  // SQLite accepts numbered positional parameters (`?1`), whereas the
  // MySQL wire protocol used by Vitess uses ordinary `?` placeholders.
  return sql.replace(/\?\d+/g, '?')
}

function resultRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    if (Array.isArray(record.rows)) return record.rows as T[]
    if (Array.isArray(record.results)) return record.results as T[]
  }
  return []
}

function runResult(result: unknown): RunResult {
  const record = result && typeof result === 'object' ? result as Record<string, unknown> : {}
  return {
    changes: Number(record.affectedRows ?? record.changes ?? record.rowCount ?? 0),
    lastInsertRowid: Number(record.lastInsertRowid ?? record.insertId ?? record.last_insert_id ?? 0),
  }
}

export class Statement<T = Record<string, unknown>> {
  constructor(private readonly executor: SqlExecutor, private readonly sql: string) {}

  async all(...values: unknown[]): Promise<T[]> {
    return resultRows<T>(await this.executor.unsafe(portableSql(this.sql), parameters(values)).execute())
  }

  async get(...values: unknown[]): Promise<T | null> {
    return (await this.all(...values))[0] ?? null
  }

  async run(...values: unknown[]): Promise<RunResult> {
    return runResult(await this.executor.unsafe(portableSql(this.sql), parameters(values)).execute())
  }
}

/**
 * Small compatibility surface for PredictHQ's raw SQL while all connection,
 * pooling, dialect, and transaction behavior comes from Stacks. Every method
 * is asynchronous because production uses Vitess over the MySQL protocol.
 */
export class Database {
  constructor(private readonly executor: SqlExecutor = stacksDb as unknown as SqlExecutor) {}

  query<T = Record<string, unknown>>(sql: string): Statement<T> {
    return new Statement<T>(this.executor, sql)
  }

  prepare<T = Record<string, unknown>>(sql: string): Statement<T> {
    return this.query<T>(sql)
  }

  async run(sql: string, values: unknown[] = []): Promise<RunResult> {
    return new Statement(this.executor, sql).run(values)
  }

  async transaction<T>(fn: (transaction: Database) => Promise<T> | T): Promise<T> {
    if (!this.executor.transaction)
      throw new Error('The configured database driver does not support transactions')
    return await this.executor.transaction(async transaction => await fn(new Database(transaction)))
  }

  async updateOrInsert(table: string, match: Record<string, unknown>, values: Record<string, unknown>): Promise<void> {
    if (!this.executor.updateOrInsert)
      throw new Error('The configured database driver does not support updateOrInsert')
    await this.executor.updateOrInsert(table, match, values)
  }

  async insertOrIgnore(table: string, values: Record<string, unknown>): Promise<void> {
    if (!this.executor.insertOrIgnore)
      throw new Error('The configured database driver does not support insertOrIgnore')
    await this.executor.insertOrIgnore(table, values)
  }

  close(): void {
    // The Stacks connection pool is process-scoped and intentionally remains
    // open across requests and jobs.
  }
}

/** Retained for backup/import tooling that needs to locate the legacy file. */
export function resolveDbPath(): string {
  const configured = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return configured.startsWith('/') ? configured : `${process.cwd()}/${configured}`
}

export function openRead(): Database {
  return new Database()
}

export function openWrite(): Database {
  return new Database()
}

export async function transact<T>(database: Database, fn: (transaction: Database) => Promise<T> | T): Promise<T> {
  return await database.transaction(fn)
}
