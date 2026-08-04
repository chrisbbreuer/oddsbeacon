import { ingestEspn } from '../../Services/ingest/espn'
import { openWrite } from '../../Support/db'

/**
 * Pull fixtures, teams, and finished scores from ESPN.
 *
 * The schedule pass runs independently of, and more often than, the odds
 * pass. Prices are worthless without an event to hang them on, and ESPN
 * costs nothing to poll, so discovering fixtures early is free while
 * discovering them via a metered odds feed is not.
 */
export default {
  name: 'IngestSchedule',
  description: 'Ingest fixtures, teams, and final scores from ESPN.',

  async handle() {
    const db = openWrite()
    try {
      return await ingestEspn(db)
    }
    finally {
      db.close()
    }
  },
}
