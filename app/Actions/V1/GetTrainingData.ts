import type { RequestLike } from '../../Support/api'
import { freshness, ok, paginate, Params } from '../../Support/api'
import { openRead } from '../../Support/db'

/**
 * GET /api/v1/training — labelled feature vectors for model training.
 *
 * Exports the snapshot store: the feature vector as it stood before
 * kickoff, paired with what actually happened. This is the endpoint that
 * makes the whole system useful to a model rather than only to a reader.
 *
 * Only **labelled** rows are exported by default. An unlabelled snapshot
 * has no target, and including it invites a caller to treat the absence of
 * an outcome as an outcome.
 *
 * Every row carries `capturedAt` and `hoursToStart` so a caller can split
 * train and test chronologically. Splitting a betting dataset at random is
 * the standard way to fool yourself: rows from the same event land on both
 * sides, and the model scores itself on games it has already partly seen.
 */
export default {
  name: 'V1GetTrainingData',
  description: 'Labelled pre-kickoff feature vectors for model training.',

  async handle(request?: RequestLike) {
    const params = new Params(request)

    const sport = params.string('sport', { max: 40 })
    const marketType = params.string('market', { allow: ['h2h', 'spreads', 'totals'] })
    const since = params.instant('since')
    const includeUnlabelled = params.string('includeUnlabelled', { allow: ['true', 'false'] }) === 'true'
    const limit = params.int('limit', { min: 1, max: 5000, default: 1000 })!
    const offset = params.int('offset', { min: 0, default: 0 })!

    const invalid = params.invalid()
    if (invalid)
      return invalid

    const where: string[] = includeUnlabelled ? ['1 = 1'] : ['fs.label IN (0, 1)']
    const args: unknown[] = []

    if (sport) {
      where.push('fs.sport_slug = ?')
      args.push(sport)
    }
    if (marketType) {
      where.push('fs.market_type = ?')
      args.push(marketType)
    }
    if (since) {
      where.push('fs.captured_at >= ?')
      args.push(since)
    }

    const clause = where.join(' AND ')
    const db = openRead()

    try {
      const total = (await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM feature_snapshots fs WHERE ${clause}`)
        .get(...args))?.n ?? 0

      const rows = await db.query<Record<string, any>>(`
        SELECT
          fs.id, fs.selection_id, fs.captured_at, fs.hours_to_start,
          fs.best_price, fs.fair_prob, fs.sharp_prob, fs.edge_pct, fs.overround_pct,
          fs.book_count, fs.price_std_dev, fs.open_price, fs.move_from_open_pct,
          fs.velocity_pct_per_hour, fs.steam_score, fs.reverse_line_move,
          fs.direction_changes, fs.sport_slug, fs.market_type, fs.side,
          fs.label, fs.closing_fair_prob, fs.clv_pct
        FROM feature_snapshots fs
        WHERE ${clause}
        ORDER BY fs.captured_at ASC, fs.id ASC
        LIMIT ? OFFSET ?
      `).all(...args, limit, offset)

      const data = rows.map(r => ({
        id: r.id,
        selectionId: r.selection_id,
        capturedAt: r.captured_at,
        features: {
          hoursToStart: r.hours_to_start,
          bestPrice: r.best_price,
          fairProb: r.fair_prob,
          sharpProb: r.sharp_prob,
          edgePct: r.edge_pct,
          overroundPct: r.overround_pct,
          bookCount: r.book_count,
          priceStdDev: r.price_std_dev,
          openPrice: r.open_price,
          moveFromOpenPct: r.move_from_open_pct,
          velocityPctPerHour: r.velocity_pct_per_hour,
          steamScore: r.steam_score,
          reverseLineMove: r.reverse_line_move === 1,
          directionChanges: r.direction_changes,
          sportSlug: r.sport_slug,
          marketType: r.market_type,
          side: r.side,
        },
        // -1 unknown, 0 lost, 1 won. Pushes are excluded upstream: a
        // voided market has no target to learn from.
        label: r.label,
        closingFairProb: r.closing_fair_prob,
        clvPct: r.clv_pct,
      }))

      return ok(data, {
        request,
        cacheSeconds: 300,
        pagination: paginate(total, limit, offset),
        meta: {
          freshness: await freshness(),
          note: 'Split chronologically on capturedAt. A random split leaks rows from the same event across train and test.',
        },
      })
    }
    finally {
      db.close()
    }
  },
}
