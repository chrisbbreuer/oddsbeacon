import { Database } from 'bun:sqlite'

/**
 * Winning-pattern analytics over the ingested prediction-market tape.
 *
 * Two passes, both plain SQL over the ingest tables:
 *
 * 1. Score fills — once a market settles, every unscored fill on it is
 *    marked won/lost by comparing the side bought to the market result.
 * 2. Aggregate traders — per attributable trader (Polymarket wallets),
 *    recompute volume, sizing, win rate and a smart-money score.
 *
 * The smart score answers "how much should we trust this account's next
 * buy?": a Bayesian-shrunk win rate (so 2/2 doesn't beat 40/50) scaled
 * by how much evidence exists, mapped to 0..100.
 */

/** Trades ≥ this notional (USD) mark the account as a whale. */
const WHALE_SINGLE_TRADE = 10_000
/** Total notional (USD) beyond which an account is a whale regardless of sizing. */
const WHALE_TOTAL_NOTIONAL = 100_000
/** Pseudo-observations pulled toward 50% when shrinking win rates. */
const PRIOR_WEIGHT = 6

export interface AnalyticsSummary {
  scoredTrades: number
  tradersUpdated: number
  whales: number
}

export function runAnalytics(db: Database): AnalyticsSummary {
  const now = new Date().toISOString()

  // Pass 1 — score unscored fills on settled markets. A fill wins when the
  // side it bought matches the market's resolved result.
  const scored = db.prepare(`
    UPDATE market_trades SET
      is_winner = CASE WHEN side = (
        SELECT result FROM prediction_markets pm WHERE pm.id = market_trades.prediction_market_id
      ) THEN 1 ELSE 0 END,
      updated_at = ?
    WHERE is_winner = -1
      AND prediction_market_id IN (
        SELECT id FROM prediction_markets WHERE status = 'settled' AND result != ''
      )
  `).run(now)

  // Pass 2 — recompute aggregates for every attributable trader. The smart
  // score shrinks the raw win rate toward 0.5 with PRIOR_WEIGHT pseudo-trades
  // then rescales 0.5..1 → 0..100, so only sustained above-coin-flip
  // accuracy earns a high score.
  const updated = db.prepare(`
    UPDATE market_traders SET
      trade_count = s.n,
      total_notional = s.total,
      avg_trade_size = s.avg_size,
      max_trade_size = s.max_size,
      resolved_trade_count = s.resolved,
      winning_trade_count = s.wins,
      win_rate = CASE WHEN s.resolved > 0 THEN CAST(s.wins AS REAL) / s.resolved ELSE 0 END,
      smart_score = MAX(0, MIN(100, ROUND(
        ((s.wins + ${PRIOR_WEIGHT} * 0.5) / (s.resolved + ${PRIOR_WEIGHT}) - 0.5) * 200, 1
      ))),
      is_whale = CASE WHEN s.max_size >= ${WHALE_SINGLE_TRADE} OR s.total >= ${WHALE_TOTAL_NOTIONAL} THEN 1 ELSE 0 END,
      updated_at = ?
    FROM (
      SELECT
        market_trader_id AS tid,
        COUNT(*) AS n,
        SUM(notional) AS total,
        AVG(notional) AS avg_size,
        MAX(notional) AS max_size,
        SUM(CASE WHEN is_winner != -1 THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN is_winner = 1 THEN 1 ELSE 0 END) AS wins
      FROM market_trades
      WHERE market_trader_id != 0
      GROUP BY market_trader_id
    ) AS s
    WHERE market_traders.id = s.tid
  `).run(now)

  const whales = db.query('SELECT COUNT(*) AS c FROM market_traders WHERE is_whale = 1').get() as { c: number }

  return {
    scoredTrades: Number(scored.changes),
    tradersUpdated: Number(updated.changes),
    whales: whales.c,
  }
}
