import { loadBoard } from '../../Support/odds'

/**
 * GET /api/odds/arbitrage — markets where line-shopping the best price on
 * every outcome implies a total probability under 100%, i.e. a guaranteed
 * profit by splitting the stake across books.
 */
export default {
  name: 'GetArbitrage',
  description: 'Markets that currently offer a cross-book arbitrage.',

  async handle() {
    const board = loadBoard()
    const events = board.events.filter(e => e.hold?.isArbitrage)
    return { count: events.length, events }
  },
}
