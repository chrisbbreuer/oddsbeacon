import { Database } from '../../Support/db'
import { log } from '@stacksjs/logging'
import { runAllStrategies } from '../../Services/trading/run'

/**
 * One pass of the automated trading loop across every active strategy.
 *
 * Shared by the schedule (app/Jobs/AutoTrade.ts) and a manual trigger,
 * so a user pressing "run now" exercises exactly the code the schedule
 * does — a manual path that skips a risk check is a manual path that
 * eventually places an order the schedule would have refused.
 */
export default {
  name: 'RunAutoTrade',
  description: 'Score markets, judge candidates, and place approved orders for every active strategy.',

  async handle() {
    const db = new Database()

    try {
      const summaries = await runAllStrategies(db)

      const totals = summaries.reduce(
        (acc, s) => ({
          candidates: acc.candidates + s.candidates,
          decisions: acc.decisions + s.decisionsWritten,
          orders: acc.orders + s.ordersPlaced,
          skipped: acc.skipped + s.skipped,
        }),
        { candidates: 0, decisions: 0, orders: 0, skipped: 0 },
      )

      log.info(`[trading] ${summaries.length} strategies · ${totals.candidates} candidates · ${totals.decisions} decisions · ${totals.orders} orders placed · ${totals.skipped} skipped`)

      return { strategies: summaries.length, ...totals, summaries }
    }
    finally {
      db.close()
    }
  },
}
