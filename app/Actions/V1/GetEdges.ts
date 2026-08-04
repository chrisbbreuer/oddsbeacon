import type { RequestLike } from '../../Support/api'
import { freshness, ok, paginate, Params } from '../../Support/api'
import { openRead } from '../../Support/db'

/**
 * GET /api/v1/edges — selections whose best price beats fair value.
 *
 * The flagship endpoint, and the one that could not honestly exist before:
 * ranking by edge requires a de-vigged fair probability to measure against,
 * and previously there was none. Ranking against raw implied probability
 * would have surfaced whichever markets carried the most margin, which is
 * close to the opposite of what a user wants.
 *
 * `minBooks` defaults above one on purpose. A single book's price
 * de-vigged against itself is not a consensus, and the largest apparent
 * edges almost always come from the thinnest evidence.
 */
export default {
  name: 'V1GetEdges',
  description: 'Selections where the best available price beats de-vigged fair value.',

  async handle(request?: RequestLike) {
    const params = new Params(request)

    const minEdge = params.int('minEdge', { min: 0, max: 100, default: 1 })!
    const minBooks = params.int('minBooks', { min: 1, max: 20, default: 3 })!
    const sport = params.string('sport', { max: 40 })
    const marketType = params.string('market', { allow: ['h2h', 'spreads', 'totals'] })
    const limit = params.int('limit', { min: 1, max: 200, default: 50 })!
    const offset = params.int('offset', { min: 0, default: 0 })!

    const invalid = params.invalid()
    if (invalid)
      return invalid

    const where = ['f.edge_pct >= ?', 'f.book_count >= ?', `e.status = 'scheduled'`, 'e.commence_at > ?']
    const args: unknown[] = [minEdge, minBooks, new Date().toISOString()]

    if (sport) {
      where.push('sp.slug = ?')
      args.push(sport)
    }
    if (marketType) {
      where.push('m.market_type = ?')
      args.push(marketType)
    }

    const clause = where.join(' AND ')
    const db = openRead()

    try {
      const total = (db.query(`
        SELECT COUNT(*) AS n
        FROM fair_prices f
        JOIN selections s ON s.id = f.selection_id
        JOIN markets m ON m.id = s.market_id
        JOIN market_events e ON e.id = m.market_event_id
        JOIN sports sp ON sp.id = e.sport_id
        WHERE ${clause}
      `).get(...args) as { n: number }).n

      const rows = db.query(`
        SELECT
          f.selection_id, f.best_price, f.prob_consensus, f.prob_sharp, f.edge_pct,
          f.kelly_fraction, f.book_count, f.sharp_book_count, f.method_spread, f.overround_pct,
          s.label, s.side, s.point,
          m.market_type, m.line, m.label AS market_label,
          e.id AS event_id, e.title, e.league, e.commence_at,
          sp.slug AS sport,
          b.name AS best_book, b.slug AS best_book_slug
        FROM fair_prices f
        JOIN selections s ON s.id = f.selection_id
        JOIN markets m ON m.id = s.market_id
        JOIN market_events e ON e.id = m.market_event_id
        JOIN sports sp ON sp.id = e.sport_id
        LEFT JOIN bookmakers b ON b.id = f.best_bookmaker_id
        WHERE ${clause}
        ORDER BY f.edge_pct DESC
        LIMIT ? OFFSET ?
      `).all(...args, limit, offset) as Array<Record<string, any>>

      const edges = rows.map(r => ({
        selectionId: r.selection_id,
        event: { id: r.event_id, title: r.title, league: r.league, sport: r.sport, commenceAt: r.commence_at },
        market: { type: r.market_type, label: r.market_label, line: r.line },
        selection: { label: r.label, side: r.side, point: r.point },
        bestPrice: r.best_price,
        bestBookmaker: r.best_book,
        bestBookmakerSlug: r.best_book_slug,
        fairProb: r.prob_consensus,
        sharpProb: r.prob_sharp,
        edgePct: r.edge_pct,
        kellyFraction: r.kelly_fraction,
        // Surfaced beside every edge rather than buried: an edge computed
        // from three books with wide method disagreement deserves less
        // trust than the same number from ten in agreement, and the caller
        // cannot make that judgement without these.
        confidence: {
          bookCount: r.book_count,
          sharpBookCount: r.sharp_book_count,
          methodSpread: r.method_spread,
          overroundPct: r.overround_pct,
        },
      }))

      return ok(edges, {
        request,
        cacheSeconds: 20,
        pagination: paginate(total, limit, offset),
        meta: { freshness: freshness(), minEdge, minBooks },
      })
    }
    finally {
      db.close()
    }
  },
}
