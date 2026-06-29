import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'
import BroadcastBoard from '../Actions/Odds/BroadcastBoard'

/**
 * Pushes the latest odds board to realtime subscribers on a cadence.
 * Reuses the BroadcastBoard action so the same logic backs the schedule,
 * a manual dispatch, and a price-change event. Scheduled in
 * app/Scheduler.ts.
 */
export default new Job({
  name: 'BroadcastOdds',
  description: 'Broadcast the latest odds board to the realtime `odds` channel',
  queue: 'default',
  tries: 1,
  backoff: 3,
  rate: Every.Minute,

  handle: async () => {
    return BroadcastBoard.handle()
  },
})
