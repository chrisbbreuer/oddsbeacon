import type { OddsProvider, OddsUpdate } from './provider'
import { Database } from 'bun:sqlite'
import process from 'node:process'

function dbPath(): string {
  const p = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return p.startsWith('/') ? p : `${process.cwd()}/${p}`
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Real odds feed via The Odds API (the-odds-api.com). Enabled when
 * `ODDS_API_KEY` is set. Outcomes are matched back to our seeded
 * selections/bookmakers by normalized name, so only games we already
 * track get updated — extending coverage is a matter of seeding the
 * matching events. Anything it can't map is skipped (returns no update).
 */
export class TheOddsApiProvider implements OddsProvider {
  readonly name = 'the-odds-api'
  // Sports keys to poll; align with the leagues we seed.
  private readonly sports = ['basketball_nba', 'americanfootball_nfl', 'soccer_epl', 'icehockey_nhl', 'baseball_mlb']

  constructor(private readonly apiKey: string) {}

  async fetchUpdates(): Promise<OddsUpdate[]> {
    const db = new Database(dbPath(), { readonly: true })
    let selectionByName: Map<string, number>
    let bookmakerByName: Map<string, number>
    try {
      selectionByName = new Map(
        (db.query('SELECT id, label FROM selections').all() as Array<{ id: number, label: string }>)
          .map(r => [norm(r.label), r.id]),
      )
      bookmakerByName = new Map(
        (db.query('SELECT id, name, slug FROM bookmakers').all() as Array<{ id: number, name: string, slug: string }>)
          .flatMap(r => [[norm(r.name), r.id], [norm(r.slug), r.id]] as Array<[string, number]>),
      )
    }
    finally {
      db.close()
    }

    const updates: OddsUpdate[] = []
    for (const sport of this.sports) {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${this.apiKey}&regions=us,uk&markets=h2h&oddsFormat=decimal`
      try {
        const res = await fetch(url)
        if (!res.ok)
          continue
        const events = await res.json() as Array<{ bookmakers?: Array<{ key: string, title: string, markets?: Array<{ key: string, outcomes?: Array<{ name: string, price: number }> }> }> }>
        for (const ev of events) {
          for (const book of ev.bookmakers ?? []) {
            const bookmakerId = bookmakerByName.get(norm(book.title)) ?? bookmakerByName.get(norm(book.key))
            if (bookmakerId == null)
              continue
            for (const market of book.markets ?? []) {
              for (const outcome of market.outcomes ?? []) {
                const selectionId = selectionByName.get(norm(outcome.name))
                if (selectionId != null && typeof outcome.price === 'number')
                  updates.push({ selectionId, bookmakerId, price: outcome.price })
              }
            }
          }
        }
      }
      catch {
        // Network/feed error for this sport — skip; other sports still update.
      }
    }
    return updates
  }
}
