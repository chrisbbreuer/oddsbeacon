import { Database } from '../../Support/db'
import { log } from '@stacksjs/logging'
import { syncOrders } from '../../Services/trading/sync'

/**
 * One reconciliation pass over every open order.
 *
 * Runs far more often than the trading loop that creates the orders.
 * Placement is deliberate and slow; a fill is not, and every number a
 * user sees — exposure, position count, what the daily loss limit has
 * to work with — is stale until this has run.
 */
export default {
  name: 'SyncOrders',
  description: 'Reconcile open exchange orders against the venue and expire stale resting orders.',

  async handle() {
    const db = new Database()

    try {
      const summary = await syncOrders(db)

      if (summary.examined > 0) {
        log.info(`[trading] reconciled ${summary.examined} orders · ${summary.advanced} advanced · ${summary.recovered} recovered · ${summary.expired} expired · ${summary.unreachable} unreachable`)
      }

      return summary
    }
    finally {
      db.close()
    }
  },
}
