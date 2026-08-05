import type { Database } from '../../Support/db'
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
export async function writePrices(db: Database, writes: PriceWrite[]): Promise<PriceWriteResult> {
  const now = nowIso()

  const previous = db.prepare('SELECT price, point FROM odds WHERE selection_id = ? AND bookmaker_id = ?')

  let written = 0
  let changed = 0
  let snapshots = 0

  for (const w of writes) {
    if (!Number.isFinite(w.price) || w.price <= 1)
      continue

    const prior = await previous.get(w.selectionId, w.bookmakerId) as { price: number, point: number | null } | null
    const point = w.point ?? null
    const implied = impliedProbability(w.price)

    await db.updateOrInsert('odds', { selection_id: w.selectionId, bookmaker_id: w.bookmakerId }, {
      price: w.price,
      american: toAmericanNumber(w.price),
      implied_prob: implied,
      point,
      limit_amount: w.limitAmount ?? 0,
      available: w.available === false ? 0 : 1,
      observed_at: w.observedAt || now,
      updated_at: now,
    })
    written++

    const moved = prior === null || prior.price !== w.price || (prior.point ?? null) !== point
    if (moved) {
      changed++
      const exists = await db.query<{ id: number }>(
        'SELECT id FROM odds_snapshots WHERE selection_id = ? AND bookmaker_id = ? AND captured_at = ?',
      ).get(w.selectionId, w.bookmakerId, now)
      await db.insertOrIgnore('odds_snapshots', {
        selection_id: w.selectionId,
        bookmaker_id: w.bookmakerId,
        price: w.price,
        implied_prob: implied,
        point,
        captured_at: now,
        is_opening: prior === null ? 1 : 0,
        created_at: now,
        updated_at: now,
      })
      if (!exists)
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
export async function loadBookmakerIndex(db: Database): Promise<Map<string, number>> {
  const rows = await db
    .query<{ id: number, name: string, slug: string, provider_key: string }>('SELECT id, name, slug, provider_key FROM bookmakers WHERE active = 1')
    .all()

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
