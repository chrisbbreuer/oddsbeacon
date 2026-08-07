import type { RequestLike } from '../../Support/api'
import { fail, ok, Params } from '../../Support/api'
import { openRead } from '../../Support/db'
import { coverageForEvent } from '../../Services/quant/history'

/**
 * GET /api/v1/events/{id}/markets — what each book offers on one event.
 *
 * Distinct from `/events/{id}`, which returns the markets and their
 * current prices. This answers the prior question: which books are
 * quoting this event at all, and on what.
 *
 * The two differ in the case that matters. A book that pulled its player
 * props ten minutes before kickoff and a book that never offered them both
 * show no prop prices, and only the first is normal — the first is a
 * market closing, the second is a hole in our coverage. `lastSeenAt` is
 * what tells them apart.
 */
export default {
  name: 'V1GetEventMarkets',
  description: 'Which bookmakers offer which markets on an event, and when each was last seen.',

  async handle(request?: RequestLike) {
    const params = new Params(request)
    const id = params.int('id', { min: 1 })

    const invalid = params.invalid()
    if (invalid)
      return invalid

    if (id === undefined)
      return fail('invalid_request', 'An event id is required', { id: 'required' })

    const db = openRead()
    try {
      const coverage = await coverageForEvent(db, id)

      // An event with no coverage rows is either unknown to us or has
      // never been polled. Both are a 404 from the caller's side — we
      // cannot describe what this event offers.
      if (coverage.length === 0)
        return fail('not_found', `No market coverage recorded for event ${id}.`)

      // Grouped by book, because "what does DraftKings have" is the
      // question people actually arrive with.
      const byBook = new Map<string, { bookmaker: string, markets: Array<{ marketType: string, lineCount: number, lastSeenAt: string }> }>()

      for (const row of coverage) {
        const entry = byBook.get(row.bookmaker) ?? { bookmaker: row.bookmaker, markets: [] }
        entry.markets.push({ marketType: row.marketType, lineCount: row.lineCount, lastSeenAt: row.lastSeenAt })
        byBook.set(row.bookmaker, entry)
      }

      return ok([...byBook.values()], {
        request,
        cacheSeconds: 30,
        meta: { eventId: id, bookmakers: byBook.size },
      })
    }
    finally {
      db.close()
    }
  },
}
