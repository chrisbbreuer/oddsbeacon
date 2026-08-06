import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

/**
 * Checking that the migration set agrees with the cluster it is for.
 *
 * Vitess is two very different databases behind one wire protocol. An
 * unsharded keyspace passes DDL through to a single MySQL, so
 * AUTO_INCREMENT and foreign keys work exactly as they do there. A
 * sharded one has neither: ids come from sequence tables declared in a
 * VSchema, and cross-shard foreign keys do not exist.
 *
 * The migration generator picks between those two profiles from
 * `DB_VITESS_SHARDED`, and it assumes **sharded** when the variable is
 * absent. So a generator run in a shell that happens not to have it set
 * emits tables for a cluster we do not have: no AUTO_INCREMENT, nothing
 * to allocate ids, and a file that looks entirely ordinary next to the
 * ones around it. Nobody finds out until the first insert.
 *
 * That failure is invisible at every stage except the last, which is
 * what makes it worth a check rather than a comment.
 */

const VITESS_DIR = 'database/migrations/vitess'

export interface SchemaProblem {
  file: string
  table: string
  detail: string
}

/** True when the keyspace is sharded, read the way the generator reads it. */
export function keyspaceIsSharded(value: string | undefined = process.env.DB_VITESS_SHARDED): boolean {
  const raw = value?.trim().toLowerCase()
  if (raw === undefined || raw === '')
    return true

  return !['0', 'false', 'no', 'off'].includes(raw)
}

/**
 * Tables whose id allocation does not match the keyspace.
 *
 * On an unsharded keyspace every table needs AUTO_INCREMENT, because
 * nothing else assigns an id and the application reads one back after
 * every insert. On a sharded one no table may have it, and each needs a
 * sequence in the VSchema instead — which this cannot verify from disk,
 * so it says so rather than implying it checked.
 */
export function auditVitessMigrations(
  root: string = process.cwd(),
  sharded: boolean = keyspaceIsSharded(),
): SchemaProblem[] {
  const dir = join(root, VITESS_DIR)

  let files: string[]
  try {
    files = readdirSync(dir).filter(file => /^\d+-create-.+-table\.sql$/.test(file)).sort()
  }
  catch {
    // No Vitess set at all is a valid state for a project that does not
    // deploy on it, and not something to fail a preflight over.
    return []
  }

  const problems: SchemaProblem[] = []

  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf-8')
    const table = file.match(/^\d+-create-(.+)-table\.sql$/)?.[1] ?? file

    // Only the primary key line matters, and only for tables that have
    // one. A pivot table keyed on its two foreign keys is not a problem.
    const primaryKey = sql.match(/`id`[^,\n]*PRIMARY KEY[^,\n]*/i)?.[0]
    if (!primaryKey)
      continue

    const hasAutoIncrement = /auto_increment/i.test(primaryKey)

    if (!sharded && !hasAutoIncrement) {
      problems.push({
        file,
        table,
        detail: 'has no AUTO_INCREMENT on an unsharded keyspace, so nothing allocates its ids and every insert will fail. Regenerate with DB_VITESS_SHARDED=false.',
      })
      continue
    }

    if (sharded && hasAutoIncrement) {
      problems.push({
        file,
        table,
        detail: 'declares AUTO_INCREMENT, which a sharded keyspace rejects. Regenerate with DB_VITESS_SHARDED=true and give the table a sequence in the VSchema.',
      })
    }
  }

  return problems
}
