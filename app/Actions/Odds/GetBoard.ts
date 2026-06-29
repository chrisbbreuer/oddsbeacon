import { loadBoard } from '../../Support/odds'

/**
 * GET /api/odds — the full comparison board: every market with its best
 * lines, edges, and per-market hold / arbitrage already computed. This is
 * the single endpoint a realtime client subscribes to and then keeps in
 * sync via the `odds` broadcast channel.
 */
export default {
  name: 'GetBoard',
  description: 'Full odds board across every bookmaker and market.',

  async handle() {
    return loadBoard()
  },
}
