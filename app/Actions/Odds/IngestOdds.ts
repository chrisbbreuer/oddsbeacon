import { Database } from 'bun:sqlite'
import process from 'node:process'
import { resolveProvider } from '../../Services/odds/provider'
import BroadcastBoard from './BroadcastBoard'

function dbPath(): string {
  const p = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return p.startsWith('/') ? p : `${process.cwd()}/${p}`
}

/**
 * Pull the latest prices from the active odds provider, write them to the
 * `odds` table, append an `odds_snapshots` row per change (line history),
 * then broadcast the refreshed board on the realtime `odds` channel.
 *
 * This is the heart of the live data loop — scheduled in app/Scheduler.ts
 * and re-runnable on demand (CLI / route).
 */
export default {
  name: 'IngestOdds',
  description: 'Fetch the latest odds, persist them with history, and broadcast.',

  async handle() {
    const provider = resolveProvider()
    const updates = await provider.fetchUpdates()
    const now = new Date().toISOString()

    const db = new Database(dbPath())
    let changed = 0
    let snapshots = 0
    try {
      const updateOdd = db.prepare('UPDATE odds SET price = ?, updated_at = ? WHERE selection_id = ? AND bookmaker_id = ?')
      const insertSnapshot = db.prepare('INSERT INTO odds_snapshots (selection_id, bookmaker_id, price, captured_at, created_at) VALUES (?, ?, ?, ?, ?)')

      db.run('BEGIN')
      for (const u of updates) {
        const res = updateOdd.run(u.price, now, u.selectionId, u.bookmakerId)
        if (Number(res.changes) > 0) {
          changed++
          insertSnapshot.run(u.selectionId, u.bookmakerId, u.price, now, now)
          snapshots++
        }
      }
      db.run('COMMIT')
    }
    catch (err) {
      try { db.run('ROLLBACK') }
      catch { /* ignore */ }
      throw err
    }
    finally {
      db.close()
    }

    const bc = await BroadcastBoard.handle()
    return { provider: provider.name, updated: changed, snapshots, broadcast: bc.broadcast, at: now }
  },
}
