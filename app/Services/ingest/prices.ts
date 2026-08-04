import type { Database } from 'bun:sqlite'
import { impliedProbability, nowIso, toAmericanNumber } from '../../Support/keys'

/**
 * The single writer for prices.
 *
 * Every odds source funnels through here so the current-price row, the
 * history row, and the derived columns can never disagree. When each
 * provider wrote its own SQL it was possible — and it happened — for a
 * price to update without a matching snapshot, which makes the line look
 * as though it never moved.
 */

export interface PriceWrite {
  selectionId: number
  bookmakerId: number
  /** Decimal odds. */
  price: number
  point?: number | null
  limitAmount?: number
  available?: boolean
  /** Provider's own timestamp for the quote, if it publishes one. */
  observedAt?: string
}

export interface PriceWriteResult {
  written: number
  changed: number
  snapshots: number
}

/**
 * Upsert current prices and append history for the ones that moved.
 *
 * History is appended **only on change**. Snapshotting every poll would
 * add a row per quote per minute — billions a season — while telling us
 * nothing a change log doesn't: the price between two observations is by
 * definition the earlier one.
 *
 * `captured_at` deliberately reuses a single `now` for the whole batch.
 * The unique index on (selection, bookmaker, captured_at) then makes a
 * retried or overlapping pass idempotent rather than letting it write a
 * second identical observation that would read as a movement of zero.
 */
export function writePrices(db: Database, writes: PriceWrite[]): PriceWriteResult {
  const now = nowIso()

  const upsert = db.prepare(`
    INSERT INTO odds
      (selection_id, bookmaker_id, price, american, implied_prob, point, limit_amount, available, observed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (selection_id, bookmaker_id) DO UPDATE SET
      price = excluded.price,
      american = excluded.american,
      implied_prob = excluded.implied_prob,
      point = excluded.point,
      limit_amount = excluded.limit_amount,
      available = excluded.available,
      observed_at = excluded.observed_at,
      updated_at = excluded.updated_at
  `)

  // `IS NOT` rather than `!=`: SQLite's `!=` yields NULL when either side
  // is NULL, so a moneyline (point IS NULL) would never register as
  // changed and its history would stay empty forever.
  const previous = db.prepare('SELECT price, point FROM odds WHERE selection_id = ? AND bookmaker_id = ?')

  const snapshot = db.prepare(`
    INSERT INTO odds_snapshots
      (selection_id, bookmaker_id, price, implied_prob, point, captured_at, is_opening, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (selection_id, bookmaker_id, captured_at) DO NOTHING
  `)

  let written = 0
  let changed = 0
  let snapshots = 0

  for (const w of writes) {
    if (!Number.isFinite(w.price) || w.price <= 1)
      continue

    const prior = previous.get(w.selectionId, w.bookmakerId) as { price: number, point: number | null } | null
    const point = w.point ?? null
    const implied = impliedProbability(w.price)

    upsert.run(
      w.selectionId,
      w.bookmakerId,
      w.price,
      toAmericanNumber(w.price),
      implied,
      point,
      w.limitAmount ?? 0,
      w.available === false ? 0 : 1,
      w.observedAt || now,
      now,
      now,
    )
    written++

    const moved = prior === null || prior.price !== w.price || (prior.point ?? null) !== point
    if (moved) {
      changed++
      const res = snapshot.run(
        w.selectionId,
        w.bookmakerId,
        w.price,
        implied,
        point,
        now,
        prior === null ? 1 : 0,
        now,
        now,
      )
      if (Number(res.changes) > 0)
        snapshots++
    }
  }

  return { written, changed, snapshots }
}

/**
 * Map a bookmaker's provider key (or slug, or name) to its row id.
 *
 * Built once per pass. Every spelling points at the same id, so a feed
 * that changes how it identifies a book keeps matching — the failure mode
 * this replaces silently dropped that book's prices entirely.
 */
export function loadBookmakerIndex(db: Database): Map<string, number> {
  const rows = db
    .query('SELECT id, name, slug, provider_key FROM bookmakers WHERE active = 1')
    .all() as Array<{ id: number, name: string, slug: string, provider_key: string }>

  const index = new Map<string, number>()
  for (const row of rows) {
    for (const key of [row.provider_key, row.slug, row.name]) {
      if (key) {
        const k = key.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (k && !index.has(k))
          index.set(k, row.id)
      }
    }
  }
  return index
}
