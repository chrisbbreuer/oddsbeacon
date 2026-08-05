import { runTransfermarktBackfill } from '../Services/fundamentals/transfermarkt-backfill'

/**
 * A bounded daily resume pass. Raw history is content-addressed and upserted,
 * while current squads/injuries are requeued only after their refresh TTL.
 */
export default {
  handle: async () => runTransfermarktBackfill({ limit: 50, seed: true, refresh: true }),
}
