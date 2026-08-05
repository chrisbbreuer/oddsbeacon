import { Database } from '../../Support/db'
import { runAnalytics } from '../../Services/prediction-markets/analytics'
import { KalshiProvider } from '../../Services/prediction-markets/kalshi'
import { PolymarketProvider } from '../../Services/prediction-markets/polymarket'

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

    const db = new Database()
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
        const pending = await db.query<{ external_id: string }>(
          'SELECT external_id FROM prediction_markets WHERE venue = ? AND status != \'settled\' ORDER BY updated_at ASC LIMIT ?',
        ).all(provider.name, MARKET_REFRESH_CAP)
        for (const row of pending)
          ids.add(row.external_id)
        marketIdsByVenue.set(provider.name, ids)
      }

      const markets = (await Promise.all(tapes.map(({ provider }) =>
        provider.fetchMarketsByIds([...marketIdsByVenue.get(provider.name) ?? []].slice(0, MARKET_REFRESH_CAP)),
      ))).flat()

      await db.transaction(async (transaction) => {
        for (const m of markets) {
          await transaction.updateOrInsert('prediction_markets', { venue: m.venue, external_id: m.externalId }, {
            question: m.question, outcome_label: m.outcomeLabel ?? '', category: m.category, status: m.status,
            result: m.result, volume: m.volume, liquidity: m.liquidity, last_price: m.lastPrice,
            ends_at: m.endsAt, updated_at: now,
          })
          marketsUpserted++
        }

        const marketId = transaction.prepare<{ id: number }>('SELECT id FROM prediction_markets WHERE venue = ? AND external_id = ?')
        const traderId = transaction.prepare<{ id: number, alias: string }>('SELECT id, alias FROM market_traders WHERE venue = ? AND external_id = ?')

        for (const { trades } of tapes) {
          for (const t of trades) {
            const market = await marketId.get(t.venue, t.marketExternalId)
            if (!market)
              continue

            let tid: number | null = null
            if (t.trader) {
              const existingTrader = await traderId.get(t.venue, t.trader.externalId)
              await transaction.updateOrInsert('market_traders', { venue: t.venue, external_id: t.trader.externalId }, {
                alias: t.trader.alias || existingTrader?.alias || '', updated_at: now,
              })
              if (!existingTrader) tradersUpserted++
              tid = (await traderId.get(t.venue, t.trader.externalId))?.id ?? null
            }

            const existingTrade = await transaction.query<{ id: number }>(
              'SELECT id FROM market_trades WHERE venue = ? AND external_id = ?',
            ).get(t.venue, t.externalId)
            await transaction.insertOrIgnore('market_trades', {
              prediction_market_id: market.id, market_trader_id: tid, venue: t.venue, external_id: t.externalId,
              side: t.side, price: t.price, size: t.size, notional: t.notional, is_winner: -1,
              traded_at: t.tradedAt, created_at: now, updated_at: now,
            })
            if (!existingTrade) tradesInserted++
          }
        }
      })
    }
    catch (err) {
      db.close()
      throw err
    }

    let analytics
    try {
      analytics = await runAnalytics(db)
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
