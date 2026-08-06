import { runTransfermarktBackfill } from '../Services/fundamentals/transfermarkt-backfill'
import { monitored } from '../Services/monitoring'

/**
 * A bounded daily resume pass. Raw history is content-addressed and upserted,
 * while current squads/injuries are requeued only after their refresh TTL.
 */
export default {
  handle: monitored('RefreshTransfermarkt', async () => runTransfermarktBackfill({ limit: 50, seed: true, refresh: true })),
}
