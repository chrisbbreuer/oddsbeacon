import { Database } from 'bun:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

/**
 * Build a throwaway database from the real migration files.
 *
 * Tests resolve migrations by table name rather than by filename. The
 * generator renumbers files whenever the model set changes, so a
 * hardcoded `0000000207-create-prediction_markets-table.sql` is a test
 * that breaks on an unrelated migration — which is exactly what
 * happened, and what this exists to stop happening again.
 *
 * Index migrations are applied too: several of the queries under test
 * are only correct because of a unique index, and a schema without them
 * passes tests the real database would fail.
 */

const MIGRATIONS_DIR = 'database/migrations'

/**
 * Every migration file that creates the named table or an index on it,
 * in the order the runner would apply them.
 */
export function migrationsFor(tables: string[]): string[] {
  const dir = join(process.cwd(), MIGRATIONS_DIR)
  const wanted = new Set(tables)

  return readdirSync(dir)
    .filter((file) => {
      if (!file.endsWith('.sql'))
        return false

      const createTable = file.match(/^\d+-create-(.+)-table\.sql$/)
      if (createTable?.[1] && wanted.has(createTable[1]))
        return true

      // Alters, too. The generator emits a column addition as its own
      // `alter` file rather than by rewriting the create, so matching
      // only creates builds a schema frozen at whenever the table was
      // first added. A test then passes against a shape the real
      // database has not had for months, which is the same class of
      // breakage the name-based lookup above exists to prevent.
      const alterTable = file.match(/^\d+-alter-(.+?)-[a-z]+\.sql$/)
      if (alterTable?.[1] && wanted.has(alterTable[1]))
        return true

      const createIndex = file.match(/-index-in-(.+)\.sql$/)
      return Boolean(createIndex?.[1] && wanted.has(createIndex[1]))
    })
    .sort()
    .map(file => join(dir, file))
}

/** A database with those tables, created and indexed. */
export function schemaFor(path: string, tables: string[]): Database {
  const db = new Database(path)

  for (const file of migrationsFor(tables))
    db.exec(readFileSync(file, 'utf-8'))

  // Application queries are asynchronous in production because Vitess is
  // reached over the MySQL protocol. Keep schema setup and assertions on the
  // real SQLite handle, while exposing the same transaction/upsert surface
  // the application uses. Awaiting SQLite's synchronous statement results is
  // valid and keeps these tests focused on query behaviour rather than mocks.
  Object.assign(db, {
    async transaction<T>(fn: (transaction: Database) => Promise<T> | T): Promise<T> {
      db.exec('BEGIN')
      try {
        const result = await fn(db)
        db.exec('COMMIT')
        return result
      }
      catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
    async updateOrInsert(table: string, match: Record<string, unknown>, values: Record<string, unknown>): Promise<void> {
      const matchColumns = Object.keys(match)
      const existing = db.query(
        `SELECT 1 FROM ${table} WHERE ${matchColumns.map(column => `${column} = ?`).join(' AND ')} LIMIT 1`,
      ).get(...Object.values(match))

      if (existing) {
        const valueColumns = Object.keys(values)
        db.query(
          `UPDATE ${table} SET ${valueColumns.map(column => `${column} = ?`).join(', ')} WHERE ${matchColumns.map(column => `${column} = ?`).join(' AND ')}`,
        ).run(...Object.values(values), ...Object.values(match))
        return
      }

      const insert = { ...match, ...values }
      const columns = Object.keys(insert)
      db.query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      ).run(...Object.values(insert))
    },
    async insertOrIgnore(table: string, values: Record<string, unknown>): Promise<void> {
      const columns = Object.keys(values)
      db.query(
        `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      ).run(...Object.values(values))
    },
  })

  return db
}
