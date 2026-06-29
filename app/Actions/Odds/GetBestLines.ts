import { loadBoard } from '../../Support/odds'

/**
 * GET /api/odds/best — a flat list of the single best available price for
 * every outcome across all markets, with the book offering it and how much
 * it beats the field average by.
 */
export default {
  name: 'GetBestLines',
  description: 'Best available price for every outcome across all markets.',

  async handle() {
    const board = loadBoard()
    const bookById = Object.fromEntries(board.bookmakers.map(b => [b.id, b]))

    const lines = []
    for (const ev of board.events) {
      for (const s of ev.selections) {
        const book = s.bestBookmakerId != null ? bookById[s.bestBookmakerId] : null
        lines.push({
          marketId: ev.id,
          market: ev.title,
          league: ev.league,
          category: ev.category,
          outcome: s.label,
          edgeVsAvgPct: s.edgeVsAvgPct,
          best: {
            decimal: s.bestPrice,
            american: s.bestAmerican,
            fractional: s.bestFractional,
            impliedPct: s.bestImpliedPct,
            bookmaker: book?.name ?? null,
            bookmakerSlug: book?.slug ?? null,
          },
        })
      }
    }

    return { count: lines.length, lines }
  },
}
