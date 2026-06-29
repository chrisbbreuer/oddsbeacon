import { loadBoard } from '../../Support/odds'

/**
 * GET /api/odds/market/{id} — the full odds comparison for one market,
 * plus the bookmakers that quote it.
 */
export default {
  name: 'GetMarket',
  description: 'Odds comparison for a single market by id.',

  async handle(request: { get?: (key: string) => unknown }) {
    const id = Number(request?.get?.('id'))
    const board = loadBoard()
    const event = board.events.find(e => e.id === id)

    if (!event)
      return { error: 'Market not found', id }

    return {
      event,
      bookmakers: board.bookmakers.filter(b => event.bookmakerIds.includes(b.id)),
    }
  },
}
