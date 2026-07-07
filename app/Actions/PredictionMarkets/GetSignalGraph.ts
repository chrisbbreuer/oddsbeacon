import { loadGraph } from '../../Support/prediction-markets'

/**
 * GET /api/markets/graph — the smart-money flow network (trader and
 * market nodes, notional-weighted edges with win/loss counts), shaped
 * for the ts-charts force-directed network graph.
 */
export default {
  name: 'GetSignalGraph',
  description: 'Money-flow network of top traders and the markets they buy.',

  async handle() {
    return loadGraph()
  },
}
