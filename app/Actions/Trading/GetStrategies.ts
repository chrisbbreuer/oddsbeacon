import { Database } from 'bun:sqlite'
import { response } from '@stacksjs/router'
import { resolveEntitlements } from '../../Services/billing/entitlements'
import { databasePath } from '../../Services/trading/run'

interface StrategyRow {
  id: number
  name: string
  venue: string
  categories: string
  bankroll: number
  max_stake: number
  min_edge: number
  min_confidence: number
  max_open_positions: number
  daily_loss_limit: number
  auto_execute: number
  status: string
  halted_reason: string
  last_run_at: string
  open_orders: number
  committed: number
}

/**
 * GET /api/trading/strategies — a user's strategies and where they stand.
 *
 * The live exposure numbers are joined in rather than left to the client
 * to compute: how much a strategy has committed against its bankroll is
 * the single thing a user checks, and a UI that has to derive it is a UI
 * that will derive it differently from the executor.
 */
export default {
  name: 'GetStrategies',
  description: 'Trading strategies with their current exposure and plan entitlements.',

  async handle(request?: { user?: { id?: number } }) {
    const userId = request?.user?.id
    if (!userId)
      return response.error('Sign in to view strategies.', 401)

    const db = new Database(databasePath(), { readonly: true })

    try {
      const strategies = db.prepare(`
        SELECT
          s.id, s.name, s.venue, s.categories, s.bankroll, s.max_stake, s.min_edge,
          s.min_confidence, s.max_open_positions, s.daily_loss_limit, s.auto_execute,
          s.status, s.halted_reason, s.last_run_at,
          COALESCE(o.open_orders, 0) AS open_orders,
          COALESCE(o.committed, 0) AS committed
        FROM trading_strategies s
        LEFT JOIN (
          SELECT
            d.trading_strategy_id AS sid,
            COUNT(*) AS open_orders,
            SUM(eo.limit_price * eo.size) AS committed
          FROM exchange_orders eo
          JOIN trade_decisions d ON d.id = eo.trade_decision_id
          WHERE eo.status IN ('pending', 'open', 'partial', 'filled')
          GROUP BY d.trading_strategy_id
        ) AS o ON o.sid = s.id
        WHERE s.user_id = ?
        ORDER BY s.id
      `).all(userId) as StrategyRow[]

      const entitlements = resolveEntitlements(db, userId)

      return {
        entitlements,
        count: strategies.length,
        strategies: strategies.map(s => ({
          id: s.id,
          name: s.name,
          venue: s.venue,
          categories: s.categories ? s.categories.split(',').map(c => c.trim()).filter(Boolean) : [],
          bankroll: s.bankroll,
          maxStake: s.max_stake,
          minEdge: s.min_edge,
          minConfidence: s.min_confidence,
          maxOpenPositions: s.max_open_positions,
          dailyLossLimit: s.daily_loss_limit,
          autoExecute: s.auto_execute === 1,
          status: s.status,
          haltedReason: s.halted_reason,
          lastRunAt: s.last_run_at,
          openOrders: s.open_orders,
          committed: Math.round(s.committed * 100) / 100,
          bankrollRemaining: Math.round((s.bankroll - s.committed) * 100) / 100,
        })),
      }
    }
    finally {
      db.close()
    }
  },
}
