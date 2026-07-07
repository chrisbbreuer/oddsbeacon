import { loadSmartMoney } from '../../Support/prediction-markets'

/**
 * GET /api/markets/smart-money — traders ranked by smart-money score:
 * accounts that keep buying the side that ends up winning, with win
 * rates and sizing (whales included).
 */
export default {
  name: 'GetSmartMoney',
  description: 'Smart-money trader leaderboard with win rates and sizing.',

  async handle() {
    const traders = loadSmartMoney()
    return { count: traders.length, traders }
  },
}
