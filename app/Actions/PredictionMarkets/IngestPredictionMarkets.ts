import { Database } from 'bun:sqlite'
import process from 'node:process'
import { runAnalytics } from '../../Services/prediction-markets/analytics'
import { KalshiProvider } from '../../Services/prediction-markets/kalshi'
import { PolymarketProvider } from '../../Services/prediction-markets/polymarket'

function dbPath(): string {
  const p = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return p.startsWith('/') ? p : `${process.cwd()}/${p}`
}

/** Fills pulled from each venue's tape per run. */
const TRADES_PER_VENUE = 500
/** Cap on market metadata refreshes per venue per run (rate-limit friendly). */
const MARKET_REFRESH_CAP = 200

/**
 * Pull the public trade tape from Kalshi and Polymarket, persist markets,
 * traders and fills, then re-run the winning-pattern analytics (score
 * settled fills, refresh trader win rates / smart scores / whale flags).
 *
 * Everything here is public data — no API keys. Scheduled in
 * app/Scheduler.ts and re-runnable on demand (CLI / route).
 */
export default {
  name: 'IngestPredictionMarkets',
  description: 'Ingest public Kalshi + Polymarket trades and refresh smart-money analytics.',

  async handle() {
    const providers = [new KalshiProvider(), new PolymarketProvider()]
    const now = new Date().toISOString()

    // Fetch both tapes up front (network), then write in one transaction.
    const tapes = await Promise.all(providers.map(async p => ({
      provider: p,
      trades: await p.fetchTrades(TRADES_PER_VENUE),
    })))

    const db = new Database(dbPath())
    let tradesInserted = 0
    let marketsUpserted = 0
    let tradersUpserted = 0
    try {
      // Markets to refresh: everything referenced by new fills, plus any
      // stored market that hasn't settled yet (so its result — and the
      // win/loss scoring that depends on it — eventually lands).
      const marketIdsByVenue = new Map<string, Set<string>>()
      for (const { provider, trades } of tapes) {
        const ids = new Set(trades.map(t => t.marketExternalId))
        const pending = db.query(
          'SELECT external_id FROM prediction_markets WHERE venue = ? AND status != \'settled\' ORDER BY updated_at ASC LIMIT ?',
        ).all(provider.name, MARKET_REFRESH_CAP) as Array<{ external_id: string }>
        for (const row of pending)
          ids.add(row.external_id)
        marketIdsByVenue.set(provider.name, ids)
      }

      const markets = (await Promise.all(tapes.map(({ provider }) =>
        provider.fetchMarketsByIds([...marketIdsByVenue.get(provider.name) ?? []].slice(0, MARKET_REFRESH_CAP)),
      ))).flat()

      const upsertMarket = db.prepare(`
        INSERT INTO prediction_markets (venue, external_id, question, category, status, result, volume, liquidity, last_price, ends_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(venue, external_id) DO UPDATE SET
          question = excluded.question,
          status = excluded.status,
          result = excluded.result,
          volume = excluded.volume,
          liquidity = excluded.liquidity,
          last_price = excluded.last_price,
          ends_at = excluded.ends_at,
          updated_at = excluded.updated_at
      `)
      const upsertTrader = db.prepare(`
        INSERT INTO market_traders (venue, external_id, alias, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(venue, external_id) DO UPDATE SET
          alias = CASE WHEN excluded.alias != '' THEN excluded.alias ELSE market_traders.alias END,
          updated_at = excluded.updated_at
      `)
      const insertTrade = db.prepare(`
        INSERT OR IGNORE INTO market_trades (prediction_market_id, market_trader_id, venue, external_id, side, price, size, notional, is_winner, traded_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, -1, ?, ?, ?)
      `)
      const marketId = db.prepare('SELECT id FROM prediction_markets WHERE venue = ? AND external_id = ?')
      const traderId = db.prepare('SELECT id FROM market_traders WHERE venue = ? AND external_id = ?')

      db.run('BEGIN')
      for (const m of markets) {
        upsertMarket.run(m.venue, m.externalId, m.question, m.category, m.status, m.result, m.volume, m.liquidity, m.lastPrice, m.endsAt, now, now)
        marketsUpserted++
      }

      for (const { trades } of tapes) {
        for (const t of trades) {
          const market = marketId.get(t.venue, t.marketExternalId) as { id: number } | null
          if (!market)
            continue // metadata fetch missed it; the fill lands on a later run

          let tid: number | null = null
          if (t.trader) {
            const res = upsertTrader.run(t.venue, t.trader.externalId, t.trader.alias, now, now)
            if (Number(res.changes) > 0)
              tradersUpserted++
            tid = (traderId.get(t.venue, t.trader.externalId) as { id: number }).id
          }

          const res = insertTrade.run(market.id, tid, t.venue, t.externalId, t.side, t.price, t.size, t.notional, t.tradedAt, now, now)
          tradesInserted += Number(res.changes)
        }
      }
      db.run('COMMIT')
    }
    catch (err) {
      try { db.run('ROLLBACK') }
      catch { /* ignore */ }
      db.close()
      throw err
    }

    let analytics
    try {
      analytics = runAnalytics(db)
    }
    finally {
      db.close()
    }

    return {
      venues: providers.map(p => p.name),
      trades: tradesInserted,
      markets: marketsUpserted,
      traders: tradersUpserted,
      ...analytics,
      at: now,
    }
  },
}
