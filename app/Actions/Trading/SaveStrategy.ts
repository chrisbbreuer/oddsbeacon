import { Database } from 'bun:sqlite'
import { response } from '@stacksjs/router'
import { resolveEntitlements } from '../../Services/billing/entitlements'
import { databasePath } from '../../Services/trading/run'

/**
 * POST /api/trading/strategies — create or update a strategy.
 *
 * Two gates, and they are different questions. The strategy count is
 * about the plan; arming `autoExecute` is about whether the plan permits
 * placing orders at all. A Signal user may keep a strategy and watch what
 * it would do — that is the tier — but cannot arm it.
 *
 * Every limit is clamped rather than merely validated. A rejected form
 * teaches the user the bound; a silently accepted 10,000% Kelly fraction
 * does not.
 */

/** Ceilings that hold regardless of plan, as a backstop on a typo. */
const MAX_BANKROLL = 1_000_000
const MAX_STAKE = 100_000
const MAX_POSITIONS = 500

export default {
  name: 'SaveStrategy',
  description: 'Create or update a trading strategy within the user plan limits.',

  async handle(request?: { get?: (key: string) => string | undefined, user?: { id?: number } }) {
    const userId = request?.user?.id
    if (!userId)
      return response.error('Sign in to manage strategies.', 401)

    const db = new Database(databasePath())

    try {
      const entitlements = resolveEntitlements(db, userId)

      if (entitlements.tier === 'none')
        return response.error('An active subscription is required to create a strategy.', 402)

      const id = Number(request?.get?.('id') ?? 0) || 0
      const autoExecute = request?.get?.('autoExecute') === 'true'

      if (autoExecute && !entitlements.canAutoExecute) {
        return response.error(
          `Automated execution is not included in the ${entitlements.tier} plan. Upgrade to Auto to place orders.`,
          402,
        )
      }

      if (!id && entitlements.maxStrategies !== null) {
        const existing = db.prepare('SELECT COUNT(*) AS n FROM trading_strategies WHERE user_id = ?')
          .get(userId) as { n: number }

        if (existing.n >= entitlements.maxStrategies) {
          return response.error(
            `The ${entitlements.tier} plan includes ${entitlements.maxStrategies} strategy${entitlements.maxStrategies === 1 ? '' : 'ies'}. Upgrade for more.`,
            402,
          )
        }
      }

      const venue = (request?.get?.('venue') ?? 'both').toLowerCase()
      if (!['kalshi', 'polymarket', 'both'].includes(venue))
        return response.error(`Unknown venue: ${venue}.`, 422)

      const fields = {
        name: (request?.get?.('name') ?? 'Untitled strategy').slice(0, 80),
        venue,
        categories: (request?.get?.('categories') ?? '').slice(0, 300),
        bankroll: clamp(Number(request?.get?.('bankroll') ?? 1000), 1, MAX_BANKROLL),
        maxStake: clamp(Number(request?.get?.('maxStake') ?? 100), 1, MAX_STAKE),
        minEdge: clamp(Number(request?.get?.('minEdge') ?? 0.04), 0, 0.5),
        minConfidence: clamp(Number(request?.get?.('minConfidence') ?? 0.65), 0, 1),
        maxOpenPositions: Math.floor(clamp(Number(request?.get?.('maxOpenPositions') ?? 10), 1, MAX_POSITIONS)),
        dailyLossLimit: clamp(Number(request?.get?.('dailyLossLimit') ?? 250), 0, MAX_BANKROLL),
        autoExecute: autoExecute ? 1 : 0,
        // Arming a strategy is what 'active' means, so the two move
        // together: a user who turns off auto-execution has paused it,
        // not left it running with nothing to do.
        status: request?.get?.('status') === 'active' ? 'active' : 'paused',
      }

      // A stake bigger than the bankroll is not a limit, it is a typo —
      // and the executor would enforce the bankroll anyway, so honour
      // the smaller number here where the user can see it.
      fields.maxStake = Math.min(fields.maxStake, fields.bankroll)

      const now = new Date().toISOString()

      if (id) {
        const owned = db.prepare('SELECT id FROM trading_strategies WHERE id = ? AND user_id = ?')
          .get(id, userId) as { id: number } | null

        if (!owned)
          return response.error('Strategy not found.', 404)

        db.prepare(`
          UPDATE trading_strategies SET
            name = ?, venue = ?, categories = ?, bankroll = ?, max_stake = ?,
            min_edge = ?, min_confidence = ?, max_open_positions = ?, daily_loss_limit = ?,
            auto_execute = ?, status = ?, halted_reason = '', updated_at = ?
          WHERE id = ?
        `).run(
          fields.name, fields.venue, fields.categories, fields.bankroll, fields.maxStake,
          fields.minEdge, fields.minConfidence, fields.maxOpenPositions, fields.dailyLossLimit,
          fields.autoExecute, fields.status, now, id,
        )

        return { id, ...fields }
      }

      const insert = db.prepare(`
        INSERT INTO trading_strategies (
          user_id, name, venue, categories, bankroll, max_stake, min_edge, min_confidence,
          max_open_positions, daily_loss_limit, auto_execute, status, halted_reason,
          last_run_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?)
      `).run(
        userId, fields.name, fields.venue, fields.categories, fields.bankroll, fields.maxStake,
        fields.minEdge, fields.minConfidence, fields.maxOpenPositions, fields.dailyLossLimit,
        fields.autoExecute, fields.status, now, now,
      )

      return { id: Number(insert.lastInsertRowid), ...fields }
    }
    finally {
      db.close()
    }
  },
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value))
    return min
  return Math.min(max, Math.max(min, value))
}
