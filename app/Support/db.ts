import { Database } from 'bun:sqlite'
import process from 'node:process'

/**
 * One place that knows where the database file is.
 *
 * This resolution was previously copy-pasted into every file that opened a
 * connection, which meant `DB_DATABASE_PATH` had to be honoured correctly
 * in each of them independently — and a copy that drifted would silently
 * read a *different, empty* database rather than fail, so the symptom was
 * "no data" rather than "wrong path".
 */
export function resolveDbPath(): string {
  const configured = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return configured.startsWith('/') ? configured : `${process.cwd()}/${configured}`
}

/**
 * Open a connection for reading.
 *
 * WAL lets readers run while the ingestion job writes, so a board request
 * never blocks behind a refresh.
 */
export function openRead(path: string = resolveDbPath()): Database {
  const db = new Database(path, { readonly: true })
  return db
}

/**
 * Open a connection for writing, configured for the ingestion workload.
 *
 * - `WAL` so readers are not blocked by the writer.
 * - `busy_timeout` so two overlapping ingest passes queue instead of
 *   throwing `SQLITE_BUSY`; the scheduler can and does overlap them when a
 *   provider is slow.
 * - `foreign_keys` on, because the schema now relies on real constraints
 *   and SQLite leaves them off by default — a detail that quietly turns
 *   every `REFERENCES` clause into a comment.
 */
export function openWrite(path: string = resolveDbPath()): Database {
  const db = new Database(path)
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA busy_timeout = 10000')
  db.run('PRAGMA foreign_keys = ON')
  return db
}

/**
 * Run `fn` inside a transaction, rolling back on any throw.
 *
 * Ingestion writes in batches of thousands of rows; without a transaction
 * each statement is its own fsync and a pass takes minutes instead of
 * milliseconds.
 */
export function transact<T>(db: Database, fn: () => T): T {
  db.run('BEGIN')
  try {
    const out = fn()
    db.run('COMMIT')
    return out
  }
  catch (err) {
    try {
      db.run('ROLLBACK')
    }
    catch {
      // The rollback itself can fail if the connection died. The original
      // error is the useful one, so let it propagate untouched.
    }
    throw err
  }
}
