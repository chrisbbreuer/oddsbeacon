import { loadBoard } from '../../Support/odds'

/**
 * GET /api/odds/book/{slug} — every price a single bookmaker is offering
 * across all markets, flagged where it is the best line available.
 */
export default {
  name: 'GetBookmaker',
  description: 'All prices from a single bookmaker across every market.',

  async handle(request: { get?: (key: string) => unknown }) {
    const slug = String(request?.get?.('slug') ?? '')
    const board = loadBoard()
    const book = board.bookmakers.find(b => b.slug === slug)

    if (!book)
      return { error: 'Bookmaker not found', slug }

    const quotes = []
    for (const ev of board.events) {
      for (const s of ev.selections) {
        const cell = s.quotes.find(q => q.bookmakerId === book.id)
        if (cell && cell.price != null) {
          quotes.push({
            marketId: ev.id,
            market: ev.title,
            outcome: s.label,
            decimal: cell.price,
            american: cell.american,
            isBest: cell.isBest,
          })
        }
      }
    }

    return { bookmaker: book, count: quotes.length, quotes }
  },
}
