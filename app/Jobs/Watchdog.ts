import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'
import { Database } from '../Support/db'
import { log } from '@stacksjs/logging'
import { runWatchdog } from '../Services/watchdog'

/**
 * Ask, every five minutes, whether the data is still arriving.
 *
 * Separate from the loops it watches, and deliberately so: a watchdog
 * that runs inside the pass it is checking cannot report the pass never
 * running, which is the failure worth catching.
 */
export default new Job({
  name: 'Watchdog',
  description: 'Alert when an ingestion loop stops producing fresh data',
  queue: 'default',
  tries: 1,
  backoff: 3,
  rate: Every.FiveMinutes,

  handle: async () => {
    const db = new Database()

    try {
      const summary = await runWatchdog(db)

      if (summary.stalls.length > 0)
        log.warn(`[watchdog] ${summary.stalls.length} of ${summary.checked} loops are stalled · ${summary.alerted} newly alerted`)

      return summary
    }
    finally {
      db.close()
    }
  },
})
