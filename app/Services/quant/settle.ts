import type { Database } from '../../Support/db'
import { devig } from '../../Support/devig'
import { nowIso } from '../../Support/keys'

/**
 * Settlement: closing lines, grading, and closing line value.
 *
 * Three passes that close the loop between what we predicted and what
 * happened. Without them the system accumulates opinions and never learns
 * whether any of them were right.
 *
 * 1. **Capture closing lines** just before kickoff. The closing price is
 *    the market's final consensus and the benchmark every claim of edge is
 *    measured against. It has to be frozen at the time, because the
 *    current-price row is overwritten on the next tick and the information
 *    is then gone forever.
 * 2. **Grade selections** against the recorded result.
 * 3. **Label feature snapshots** and compute CLV, turning the captured
 *    features into a supervised training set.
 */

/** Capture the closing line inside this many minutes of kickoff. */
const CLOSING_WINDOW_MINUTES = 15

export interface SettleResult {
  closingCaptured: number
  selectionsGraded: number
  eventsGraded: number
  snapshotsLabelled: number
}

/**
 * Freeze the closing line for events about to start.
 *
 * Runs on events inside the window that have not been captured yet, and
 * marks them so the pass is idempotent — a second run inside the same
 * window must not overwrite a price captured closer to the off with a
 * later, post-kickoff one.
 *
 * The de-vigged closing probability is computed and stored alongside the
 * raw price, because CLV measured against a raw closing price silently
 * credits the model with the book's margin.
 */
export async function captureClosingLines(db: Database): Promise<number> {
  const now = Date.now()
  const upper = new Date(now + CLOSING_WINDOW_MINUTES * 60_000).toISOString()
  // A generous lower bound catches events whose kickoff passed while the
  // worker was down. Missing a close entirely is unrecoverable — there is
  // no way to reconstruct it later — so a slightly late capture beats none.
  const lower = new Date(now - 6 * 3_600_000).toISOString()

  const events = await db.query<{ id: number, commence_at: string }>(`
    SELECT id, commence_at FROM market_events
    WHERE closing_captured_at = ''
      AND commence_at BETWEEN ? AND ?
      AND status IN ('scheduled', 'live')
  `).all(lower, upper)

  if (events.length === 0)
    return 0

  let captured = 0

  await db.transaction(async (transaction) => {
    for (const event of events) {
      const quotes = await transaction.query<{
        selection_id: number
        bookmaker_id: number
        price: number
        point: number | null
        market_id: number
      }>(`
        SELECT o.selection_id, o.bookmaker_id, o.price, o.point, s.market_id
        FROM odds o
        JOIN selections s ON s.id = o.selection_id
        JOIN markets m ON m.id = s.market_id
        WHERE m.market_event_id = ? AND o.available = 1 AND o.price > 1
        ORDER BY s.market_id, o.bookmaker_id, s.position
      `).all(event.id)

      // De-vig per (market, book) — the same grouping the fair-price pass
      // uses, and for the same reason: margin belongs to a book's view of a
      // whole market, not to one side of it.
      const grouped = new Map<string, typeof quotes>()
      for (const q of quotes) {
        const key = `${q.market_id}:${q.bookmaker_id}`
        const list = grouped.get(key) ?? []
        list.push(q)
        grouped.set(key, list)
      }

      const startMs = Date.parse(event.commence_at)
      const capturedAt = nowIso()
      const secondsBefore = Number.isFinite(startMs) ? Math.round((startMs - Date.now()) / 1000) : 0

      for (const group of grouped.values()) {
        const fair = group.length >= 2 ? devig(group.map(q => q.price)).shin : null
        for (const [index, q] of group.entries()) {
          const exists = await transaction.query<{ id: number }>(
            'SELECT id FROM closing_lines WHERE selection_id = ? AND bookmaker_id = ?',
          ).get(q.selection_id, q.bookmaker_id)
          await transaction.insertOrIgnore('closing_lines', {
            selection_id: q.selection_id,
            bookmaker_id: q.bookmaker_id,
            price: q.price,
            implied_prob: q.price > 0 ? 1 / q.price : 0,
            fair_prob: fair?.[index] ?? 0,
            point: q.point,
            captured_at: capturedAt,
            seconds_before_start: secondsBefore,
            created_at: capturedAt,
            updated_at: capturedAt,
          })
          if (!exists) captured++
        }
      }

      await transaction.prepare('UPDATE market_events SET closing_captured_at = ?, updated_at = ? WHERE id = ?')
        .run(capturedAt, capturedAt, event.id)
    }
  })

  return captured
}

/**
 * Grade every selection on events that have a result but are not yet
 * graded.
 *
 * Grading is per market type because "won" means something different in
 * each: a moneyline is decided by the winner, a spread by the margin
 * against the line, a total by the combined score. Pushes (an exact
 * landing on the line) are graded 2, not 0 — a returned stake is not a
 * loss, and scoring it as one would understate performance on every
 * market that lands flush.
 */
export async function gradeSelections(db: Database): Promise<{ events: number, selections: number }> {
  const events = await db.query<{
    event_id: number
    home_score: number
    away_score: number
    winner_side: string
    completed: number
  }>(`
    SELECT r.market_event_id AS event_id, r.home_score, r.away_score, r.winner_side, r.completed
    FROM event_results r
    WHERE r.graded_at = ''
  `).all()

  if (events.length === 0)
    return { events: 0, selections: 0 }

  let graded = 0

  await db.transaction(async (transaction) => {
    const update = transaction.prepare('UPDATE selections SET outcome = ?, graded_at = ?, updated_at = ? WHERE id = ?')
    for (const event of events) {
      const selections = await transaction.query<{
        id: number
        side: string
        point: number | null
        market_type: string
      }>(`
        SELECT s.id, s.side, s.point, m.market_type
        FROM selections s
        JOIN markets m ON m.id = s.market_id
        WHERE m.market_event_id = ?
      `).all(event.event_id)

      for (const selection of selections) {
        // An abandoned or cancelled game voids rather than settles: every
        // market pushes, because no outcome was determined.
        const outcome = event.completed === 0
          ? 2
          : gradeOne(selection, event)

        if (outcome === null)
          continue

        await update.run(outcome, nowIso(), nowIso(), selection.id)
        graded++
      }

      await transaction.prepare('UPDATE event_results SET graded_at = ?, updated_at = ? WHERE market_event_id = ?')
        .run(nowIso(), nowIso(), event.event_id)
    }
  })

  return { events: events.length, selections: graded }
}

/** 0 lost, 1 won, 2 push, null when the market type is not gradeable here. */
function gradeOne(
  selection: { side: string, point: number | null, market_type: string },
  result: { home_score: number, away_score: number, winner_side: string },
): number | null {
  const { home_score: home, away_score: away } = result

  if (selection.market_type === 'h2h') {
    if (result.winner_side === 'draw')
      return selection.side === 'draw' ? 1 : 0
    return selection.side === result.winner_side ? 1 : 0
  }

  if (selection.market_type === 'spreads') {
    if (selection.point === null)
      return null
    // The handicap is added to the side that carries it, then the adjusted
    // scores are compared.
    const margin = selection.side === 'home'
      ? (home + selection.point) - away
      : (away + selection.point) - home
    if (Math.abs(margin) < 1e-9)
      return 2
    return margin > 0 ? 1 : 0
  }

  if (selection.market_type === 'totals') {
    if (selection.point === null)
      return null
    const total = home + away
    if (Math.abs(total - selection.point) < 1e-9)
      return 2
    if (selection.side === 'over')
      return total > selection.point ? 1 : 0
    if (selection.side === 'under')
      return total < selection.point ? 1 : 0
  }

  return null
}

/**
 * Attach outcomes and CLV to the feature snapshots taken before kickoff.
 *
 * This is the step that turns the snapshot table into a training set. The
 * features were frozen at capture time and are never recomputed, so the
 * pairing of "what was knowable then" with "what happened" is honest —
 * recomputing features after the fact would leak the outcome into them and
 * produce a model that backtests beautifully and fails live.
 */
export async function labelSnapshots(db: Database): Promise<number> {
  const pending = await db.query<{ id: number, selection_id: number, best_price: number, outcome: number }>(`
    SELECT fs.id, fs.selection_id, fs.best_price, s.outcome
    FROM feature_snapshots fs
    JOIN selections s ON s.id = fs.selection_id
    WHERE fs.label = -1 AND s.outcome != -1
  `).all()

  if (pending.length === 0)
    return 0

  let labelled = 0

  await db.transaction(async (transaction) => {
    const closing = transaction.prepare<{ best_close: number | null, fair_close: number | null }>(`
      SELECT MAX(price) AS best_close, AVG(fair_prob) AS fair_close
      FROM closing_lines WHERE selection_id = ?
    `)
    const update = transaction.prepare(`
      UPDATE feature_snapshots
      SET label = ?, closing_fair_prob = ?, clv_pct = ?, labelled_at = ?, updated_at = ?
      WHERE id = ?
    `)
    for (const row of pending) {
      const close = await closing.get(row.selection_id)

      // CLV: how the price we saw compares to the price the market closed
      // at. Positive means we had the better side of the line — the
      // fastest-converging evidence that an estimate carried real edge,
      // long before win rate says anything reliable.
      const clv = close?.best_close && row.best_price > 0
        ? (row.best_price / close.best_close - 1) * 100
        : 0

      await update.run(row.outcome, close?.fair_close ?? 0, clv, nowIso(), nowIso(), row.id)
      labelled++
    }
  })

  return labelled
}

/** Run all three settlement passes in order. */
export async function settle(db: Database): Promise<SettleResult> {
  const closingCaptured = await captureClosingLines(db)
  const { events, selections } = await gradeSelections(db)
  const snapshotsLabelled = await labelSnapshots(db)

  return {
    closingCaptured,
    selectionsGraded: selections,
    eventsGraded: events,
    snapshotsLabelled,
  }
}

export { CLOSING_WINDOW_MINUTES }
