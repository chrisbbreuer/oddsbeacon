import { Database } from 'bun:sqlite'
import process from 'node:process'

/**
 * Read helpers for the community threads.
 *
 * Pure reads against a read-only handle, matching `app/Support/odds.ts` and
 * `intel.ts`, so an stx `<script server>` block can call them without the
 * ORM in scope.
 */

export interface Note {
  id: number
  authorName: string
  stance: string
  body: string
  createdAt: string
}

export interface Thread {
  marketId: number
  venue: string
  question: string
  noteCount: number
  yes: number
  no: number
  watching: number
  latest: Note[]
}

function open(): Database {
  return new Database(process.env.DB_DATABASE_PATH ?? 'database/stacks.sqlite', { readonly: true })
}

/**
 * The busiest threads, newest activity first.
 *
 * Markets with no notes are excluded rather than listed empty: a community
 * page that opens with forty silent rows reads as abandoned, and the empty
 * state below says something more useful than forty zeroes would.
 */
export function loadThreads(limit = 12): Thread[] {
  const db = open()
  try {
    const rows = db.query(`
      SELECT
        m.id                AS marketId,
        m.venue             AS venue,
        m.question          AS question,
        COUNT(n.id)         AS noteCount,
        SUM(CASE WHEN n.stance = 'yes' THEN 1 ELSE 0 END)      AS yes,
        SUM(CASE WHEN n.stance = 'no' THEN 1 ELSE 0 END)       AS no,
        SUM(CASE WHEN n.stance = 'watching' THEN 1 ELSE 0 END) AS watching,
        MAX(n.created_at)   AS lastAt
      FROM market_notes n
      JOIN prediction_markets m ON m.id = n.prediction_market_id
      WHERE n.hidden = 0
      GROUP BY m.id
      ORDER BY lastAt DESC
      LIMIT ?
    `).all(limit) as any[]

    return rows.map((r) => {
      const latest = db.query(`
        SELECT id, author_name AS authorName, stance, body, created_at AS createdAt
        FROM market_notes
        WHERE prediction_market_id = ? AND hidden = 0
        ORDER BY created_at DESC
        LIMIT 3
      `).all(r.marketId) as Note[]

      return {
        marketId: r.marketId,
        venue: r.venue,
        question: r.question,
        noteCount: r.noteCount ?? 0,
        yes: r.yes ?? 0,
        no: r.no ?? 0,
        watching: r.watching ?? 0,
        latest,
      }
    })
  }
  catch {
    // A cold database has no market_notes table yet. An empty room is a
    // real state the page renders honestly, not an error worth a 500.
    return []
  }
  finally {
    db.close()
  }
}

/** Markets worth opening a thread on when none exist yet. */
export function loadSeedMarkets(limit = 6): Array<{ id: number, venue: string, question: string }> {
  const db = open()
  try {
    return db.query(`
      SELECT id, venue, question
      FROM prediction_markets
      ORDER BY id DESC
      LIMIT ?
    `).all(limit) as Array<{ id: number, venue: string, question: string }>
  }
  catch {
    return []
  }
  finally {
    db.close()
  }
}
