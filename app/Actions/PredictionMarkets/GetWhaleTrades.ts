import { loadBigTrades } from '../../Support/prediction-markets'

/**
 * GET /api/markets/whales — the largest recent fills across Kalshi and
 * Polymarket, with win/loss status where the market has settled.
 */
export default {
  name: 'GetWhaleTrades',
  description: 'Largest recent prediction-market fills across venues.',

  async handle() {
    const trades = loadBigTrades()
    return { count: trades.length, trades }
  },
}
