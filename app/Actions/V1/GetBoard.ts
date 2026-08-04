import type { RequestLike } from '../../Support/api'
import { freshness, ok, paginate, Params } from '../../Support/api'
import { loadBoard } from '../../Support/odds'

/**
 * GET /api/v1/odds — the comparison board.
 *
 * Filterable and paginated. The unbounded version of this endpoint read
 * the entire database per request and ran a query per selection on top;
 * with a real schedule behind it that is not a slow endpoint, it is an
 * outage.
 */
export default {
  name: 'V1GetBoard',
  description: 'Odds board across every bookmaker and market, filtered and paginated.',

  async handle(request?: RequestLike) {
    const params = new Params(request)

    const sport = params.string('sport', { max: 40 })
    const category = params.string('category', { max: 60 })
    const status = params.string('status', { allow: ['scheduled', 'live', 'final', 'postponed', 'cancelled'] })
    const marketType = params.string('market', { allow: ['h2h', 'spreads', 'totals'] })
    const from = params.instant('from')
    const to = params.instant('to')
    const limit = params.int('limit', { min: 1, max: 200, default: 50 })!
    const offset = params.int('offset', { min: 0, default: 0 })!
    const historyPoints = params.int('history', { min: 0, max: 100, default: 30 })!

    const invalid = params.invalid()
    if (invalid)
      return invalid

    const board = loadBoard({ sport, category, status, marketType, from, to, limit, offset, historyPoints })

    return ok(
      {
        bookmakers: board.bookmakers,
        events: board.events,
        summary: board.summary,
        categories: board.categories,
      },
      {
        // Short: the ingest loop runs every minute, and a board a caller
        // believes is current but is not is worse than one served slowly.
        request,
        cacheSeconds: 20,
        pagination: paginate(board.total, limit, offset),
        meta: { freshness: freshness() },
      },
    )
  },
}
