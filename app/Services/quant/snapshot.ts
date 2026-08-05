import type { Database } from '../../Support/db'
import { nowIso } from '../../Support/keys'
import { movementFor } from './movement'

/**
 * Capturing the feature vector for later training.
 *
 * Snapshots are taken on **upcoming** selections only. Once an event has
 * started the features stop describing a prediction problem and start
 * describing a resolved one, and a training set that mixes the two teaches
 * a model to lean on information that will not exist at inference time.
 *
 * Values are copied, never referenced. A snapshot that joined back to
 * `fair_prices` would silently pick up numbers recomputed after the fact —
 * the classic leakage bug, which shows up as excellent backtests and poor
 * live performance rather than as an error.
 */

/** Only snapshot selections whose event starts within this horizon. */
const HORIZON_HOURS = 72

/**
 * Minimum gap between two snapshots of the same selection.
 *
 * The scheduler runs far more often than markets change meaningfully.
 * Without a floor, a season's training set would be dominated by thousands
 * of near-identical rows from quiet markets, biasing a model toward
 * whatever is quiet rather than whatever is informative.
 */
const MIN_GAP_MINUTES = 30

export interface SnapshotResult {
  captured: number
  skipped: number
}

export async function captureFeatureSnapshots(db: Database, options: { horizonHours?: number } = {}): Promise<SnapshotResult> {
  const horizon = options.horizonHours ?? HORIZON_HOURS
  const now = Date.now()
  const upper = new Date(now + horizon * 3_600_000).toISOString()
  const nowStr = new Date(now).toISOString()
  const gapCutoff = new Date(now - MIN_GAP_MINUTES * 60_000).toISOString()

  const candidates = await db.query<{
    selection_id: number
    prob_consensus: number
    prob_sharp: number
    edge_pct: number
    overround_pct: number
    book_count: number
    best_price: number
    side: string
    market_type: string
    commence_at: string
    sport_slug: string
  }>(`
    SELECT
      f.selection_id, f.prob_consensus, f.prob_sharp, f.edge_pct, f.overround_pct,
      f.book_count, f.best_price,
      s.side, m.market_type, e.commence_at, sp.slug AS sport_slug
    FROM fair_prices f
    JOIN selections s ON s.id = f.selection_id
    JOIN markets m ON m.id = s.market_id
    JOIN market_events e ON e.id = m.market_event_id
    JOIN sports sp ON sp.id = e.sport_id
    WHERE e.status = 'scheduled'
      AND e.commence_at BETWEEN ? AND ?
      AND f.best_price > 1
      AND NOT EXISTS (
        SELECT 1 FROM feature_snapshots fs
        WHERE fs.selection_id = f.selection_id AND fs.captured_at > ?
      )
  `).all(nowStr, upper, gapCutoff)

  if (candidates.length === 0)
    return { captured: 0, skipped: 0 }

  const capturedAt = nowIso()
  let captured = 0
  let skipped = 0

  await db.transaction(async (transaction) => {
    for (const row of candidates) {
      const startMs = Date.parse(row.commence_at)
      if (!Number.isFinite(startMs)) {
        skipped++
        continue
      }

      const move = await movementFor(transaction, row.selection_id)

      const exists = await transaction.query<{ id: number }>(
        'SELECT id FROM feature_snapshots WHERE selection_id = ? AND captured_at = ?',
      ).get(row.selection_id, capturedAt)
      await transaction.insertOrIgnore('feature_snapshots', {
        selection_id: row.selection_id,
        captured_at: capturedAt,
        hours_to_start: (startMs - now) / 3_600_000,
        best_price: row.best_price,
        fair_prob: row.prob_consensus,
        sharp_prob: row.prob_sharp,
        edge_pct: row.edge_pct,
        overround_pct: row.overround_pct,
        book_count: row.book_count,
        price_std_dev: move.priceStdDev,
        open_price: move.openPrice,
        move_from_open_pct: move.moveFromOpenPct,
        velocity_pct_per_hour: move.velocityPctPerHour,
        steam_score: move.steamScore,
        reverse_line_move: 0,
        direction_changes: move.directionChanges,
        sport_slug: row.sport_slug,
        market_type: row.market_type,
        side: row.side,
        extra: '',
        label: -1,
        closing_fair_prob: 0,
        clv_pct: 0,
        labelled_at: '',
        created_at: capturedAt,
        updated_at: capturedAt,
      })

      if (!exists)
        captured++
      else
        skipped++
    }
  })

  return { captured, skipped }
}

export { HORIZON_HOURS, MIN_GAP_MINUTES }
