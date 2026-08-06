import type { Database } from '../../Support/db'
import type { ExecutionOutcome, Strategy } from './execute'
import { randomUUID } from 'node:crypto'
import { bookOrderFill } from './positions'

/**
 * Trading a strategy without money.
 *
 * A strategy went from "saved" to "placing real orders at an exchange"
 * with nothing in between, so nobody — the user or us — could say whether
 * it had ever been right. Paper mode closes that gap by running the same
 * path: the same evidence, the same judgement, the same limits, the same
 * risk checks, and fills booked into the same positions table that
 * settles against the same results. What it does not do is contact a
 * venue or need an account.
 *
 * Because the record lands in the same place, the performance figures
 * for a paper strategy and a live one are computed by identical code. A
 * separate simulator with its own bookkeeping would be a second
 * implementation of the thing being measured, and the number it produced
 * would mean something subtly different from the live one — which is
 * exactly the number a user is trying to compare against.
 */

/**
 * What a simulated fill gives up to the spread.
 *
 * We record a market's last traded price, not its ask, so a buy filled
 * at the recorded price is filled at roughly half a spread better than a
 * real one would have been. Assuming a cent against ourselves keeps
 * paper results from reading systematically better than live results,
 * which is the one way a paper mode can actively mislead.
 */
const ASSUMED_SLIPPAGE = 0.01

interface PaperDecision {
  id: number
  prediction_market_id: number
  venue: string
  side: string
  limit_price: number
  size: number
}

/**
 * Fill every approved decision against the tape.
 *
 * A limit order fills only if the market is at or below the limit, and
 * the price paid is the worse of the two: the market when it is below
 * our limit, the limit when slippage carries it past. A decision that
 * cannot fill is recorded as unfilled rather than quietly credited,
 * because a paper record that fills everything is a paper record that
 * proves nothing.
 */
export async function executePaper(
  db: Database,
  strategy: Strategy,
  decisionIds: number[],
): Promise<ExecutionOutcome[]> {
  const outcomes: ExecutionOutcome[] = []
  if (decisionIds.length === 0)
    return outcomes

  const placeholders = decisionIds.map(() => '?').join(', ')
  const decisions = await db.prepare<PaperDecision>(`
    SELECT id, prediction_market_id, venue, side, limit_price, size
    FROM trade_decisions
    WHERE id IN (${placeholders})
    ORDER BY id
  `).all(...decisionIds)

  for (const decision of decisions) {
    const market = await db.prepare<{ external_id: string, last_price: number }>(
      'SELECT external_id, last_price FROM prediction_markets WHERE id = ?',
    ).get(decision.prediction_market_id)

    if (!market) {
      outcomes.push(await record(db, decision, 'cancelled', 0, 0, 'market no longer in our database'))
      continue
    }

    const fillPrice = Math.min(decision.limit_price, Number(market.last_price) + ASSUMED_SLIPPAGE)

    if (Number(market.last_price) > decision.limit_price) {
      outcomes.push(await record(db, decision, 'cancelled', 0, 0, 'the market never traded down to the limit'))
      continue
    }

    outcomes.push(await record(db, decision, 'filled', decision.size, fillPrice, '', strategy.id))
  }

  return outcomes
}

/**
 * Write the simulated order and, when it filled, the position it made.
 *
 * The venue is recorded as `paper:<venue>` so a simulated order can never
 * be mistaken for a real one in a query that forgot to filter, and the
 * account is left null because there is no account — both make the row
 * inert to the reconciliation pass, which has nothing to ask a venue
 * about.
 */
async function record(
  db: Database,
  decision: PaperDecision,
  status: string,
  filledSize: number,
  fillPrice: number,
  note: string,
  strategyId?: number,
): Promise<ExecutionOutcome> {
  const now = new Date().toISOString()

  const market = await db.prepare<{ external_id: string }>('SELECT external_id FROM prediction_markets WHERE id = ?')
    .get(decision.prediction_market_id)

  const insert = await db.prepare(`
    INSERT INTO exchange_orders (
      trade_decision_id, exchange_account_id, venue, client_order_id, external_order_id,
      market_external_id, side, limit_price, size, filled_size, avg_fill_price,
      accrued_size, accrued_cost, status, error, placed_at, created_at, updated_at
    ) VALUES (?, NULL, ?, ?, '', ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)
  `).run(
    decision.id,
    `paper:${decision.venue}`,
    randomUUID(),
    market?.external_id ?? '',
    decision.side,
    decision.limit_price,
    decision.size,
    filledSize,
    fillPrice,
    status,
    note,
    now,
    now,
    now,
  )

  if (filledSize > 0 && strategyId) {
    await bookOrderFill(db, {
      orderId: Number(insert.lastInsertRowid),
      tradingStrategyId: strategyId,
      exchangeAccountId: null,
      predictionMarketId: decision.prediction_market_id,
      venue: `paper:${decision.venue}`,
      marketExternalId: market?.external_id ?? '',
      side: decision.side,
      accruedSize: 0,
      accruedCost: 0,
    }, filledSize, fillPrice)
  }

  const placed = filledSize > 0

  await db.prepare('UPDATE trade_decisions SET status = ?, status_reason = ?, updated_at = ? WHERE id = ?')
    .run(placed ? 'executed' : 'skipped', note.slice(0, 300), now, decision.id)

  return {
    decisionId: decision.id,
    placed,
    reason: placed ? `filled on paper at ${(fillPrice * 100).toFixed(1)}` : note,
  }
}
