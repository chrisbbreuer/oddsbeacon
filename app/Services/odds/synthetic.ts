import type { OddsProvider, OddsUpdate } from './provider'
import { Database } from 'bun:sqlite'
import process from 'node:process'

function dbPath(): string {
  const p = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return p.startsWith('/') ? p : `${process.cwd()}/${p}`
}

/**
 * Synthesizes realistic line movement from the current board: each price
 * drifts a fraction of a percent per tick (bounded so odds stay sane), so
 * `./buddy dev` demonstrates the ingest → broadcast → live-update pipeline
 * without any external API key.
 */
export class SyntheticProvider implements OddsProvider {
  readonly name = 'synthetic'

  async fetchUpdates(): Promise<OddsUpdate[]> {
    const db = new Database(dbPath(), { readonly: true })
    try {
      const rows = db
        .query('SELECT selection_id, bookmaker_id, price FROM odds')
        .all() as Array<{ selection_id: number, bookmaker_id: number, price: number }>

      return rows.map((row) => {
        const drift = (Math.random() - 0.5) * 0.03 // ±1.5%
        const next = Math.max(1.02, Math.round(row.price * (1 + drift) * 100) / 100)
        return { selectionId: row.selection_id, bookmakerId: row.bookmaker_id, price: next }
      })
    }
    finally {
      db.close()
    }
  }
}
