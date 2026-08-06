import type { Database } from '../../Support/db'

/**
 * How a strategy has actually done.
 *
 * The product's claim is that every automated decision is backed by
 * evidence, and the fair-value model already has a calibration curve
 * proving its probabilities hold up. What none of that answered is the
 * question a user asks first: did this make money. Positions carry a
 * realized result now, so the answer is computable, and refusing to
 * compute it would leave the one number the engine should be judged on
 * as the one number nobody could see.
 *
 * Everything here is derived from settled positions — money that has
 * finished moving. Open positions are reported separately as exposure
 * rather than folded in at a mark, because a marked-to-market return on
 * a thin prediction market is mostly a statement about the last print.
 */

export interface Performance {
  strategyId: number
  /** Positions closed against a market result. */
  settled: number
  /** Of those, how many returned more than they cost. */
  wins: number
  /** wins / settled, or null when nothing has settled yet. */
  hitRate: number | null
  /** USD put into settled positions. */
  invested: number
  /** USD returned by them, net of what they cost. */
  realized: number
  /** realized / invested, or null when nothing has settled yet. */
  roi: number | null
  /** Largest peak-to-trough fall in cumulative realized P&L, in USD. */
  maxDrawdown: number
  /** Positions still open, and what they cost. */
  openPositions: number
  openCost: number
  /** The best and worst single results, for context on the average. */
  best: number
  worst: number
  /** When money last finished moving. */
  lastSettledAt: string | null
}

interface SettledRow {
  realized_pnl: number
  cost_basis: number
  settled_at: string
}

export async function strategyPerformance(db: Database, strategyId: number): Promise<Performance> {
  // Ordered by settlement, because drawdown is a statement about
  // sequence: the same set of results in a different order describes a
  // different experience of holding the strategy.
  const settled = await db.prepare<SettledRow>(`
    SELECT realized_pnl, cost_basis, settled_at
    FROM exchange_positions
    WHERE trading_strategy_id = ? AND status = 'settled'
    ORDER BY settled_at, id
  `).all(strategyId)

  const open = await db.prepare<{ n: number, cost: number }>(`
    SELECT COUNT(*) AS n, COALESCE(SUM(cost_basis), 0) AS cost
    FROM exchange_positions
    WHERE trading_strategy_id = ? AND status = 'open' AND size > 0
  `).get(strategyId)

  let invested = 0
  let realized = 0
  let wins = 0
  let best = 0
  let worst = 0

  let cumulative = 0
  let peak = 0
  let maxDrawdown = 0

  for (const row of settled) {
    const pnl = Number(row.realized_pnl)
    const cost = Number(row.cost_basis)

    invested += cost
    realized += pnl
    if (pnl > 0)
      wins++
    if (pnl > best)
      best = pnl
    if (pnl < worst)
      worst = pnl

    cumulative += pnl
    if (cumulative > peak)
      peak = cumulative
    if (peak - cumulative > maxDrawdown)
      maxDrawdown = peak - cumulative
  }

  return {
    strategyId,
    settled: settled.length,
    wins,
    hitRate: settled.length > 0 ? round(wins / settled.length, 4) : null,
    invested: round(invested),
    realized: round(realized),
    // Guarded on invested rather than on count: a set of positions that
    // somehow cost nothing has no return, and dividing anyway produces
    // an infinity that renders as a very confident lie.
    roi: invested > 0 ? round(realized / invested, 4) : null,
    maxDrawdown: round(maxDrawdown),
    openPositions: Number(open?.n ?? 0),
    openCost: round(Number(open?.cost ?? 0)),
    best: round(best),
    worst: round(worst),
    lastSettledAt: settled[settled.length - 1]?.settled_at ?? null,
  }
}

/** Performance for every strategy a user owns, cheapest path first. */
export async function performanceForUser(db: Database, userId: number): Promise<Performance[]> {
  const strategies = await db.prepare<{ id: number }>(
    'SELECT id FROM trading_strategies WHERE user_id = ? ORDER BY id',
  ).all(userId)

  const out: Performance[] = []
  for (const strategy of strategies)
    out.push(await strategyPerformance(db, strategy.id))

  return out
}

function round(value: number, places = 2): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}
