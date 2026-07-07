import type { PredictionMarketProvider, VenueMarket, VenueTrade } from './provider'
import { chunk, fetchJson } from './provider'

const DATA_API = 'https://data-api.polymarket.com'
const GAMMA_API = 'https://gamma-api.polymarket.com'

interface PolymarketTrade {
  proxyWallet: string
  side: string
  conditionId: string
  size: number
  price: number
  timestamp: number
  outcome: string
  transactionHash: string
  name?: string
  pseudonym?: string
}

interface GammaMarket {
  conditionId: string
  question: string
  category?: string
  closed: boolean
  umaResolutionStatus?: string
  outcomes?: string
  outcomePrices?: string
  volumeNum?: number
  liquidityNum?: number
  lastTradePrice?: number
  endDate?: string
}

function parseJsonArray(value: string | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  }
  catch {
    return []
  }
}

/** Winning outcome label for a resolved market, '' while unresolved. */
function resolveResult(m: GammaMarket): string {
  if (!m.closed)
    return ''
  const prices = parseJsonArray(m.outcomePrices).map(Number)
  const winner = prices.findIndex(p => p >= 0.999)
  if (winner < 0)
    return ''
  return (parseJsonArray(m.outcomes)[winner] ?? '').toLowerCase()
}

/**
 * Polymarket's public Data API (trade tape, attributable to proxy wallets)
 * and Gamma API (market metadata + resolution). No auth required.
 *
 * Only BUY fills are ingested: the signal we mine is "who keeps buying
 * the side that ends up winning", and a buy states that side directly.
 * The taker's wallet plus venue pseudonym ride along as the trader
 * identity, which is what makes per-account win-rate patterns possible
 * on this venue (unlike Kalshi's anonymous tape).
 */
export class PolymarketProvider implements PredictionMarketProvider {
  readonly name = 'polymarket'

  async fetchTrades(limit: number): Promise<VenueTrade[]> {
    const trades: VenueTrade[] = []
    let offset = 0
    while (trades.length < limit && offset < limit * 3) {
      const pageSize = Math.min(500, limit - trades.length)
      const url = `${DATA_API}/trades?limit=${pageSize}&offset=${offset}&takerOnly=true`
      const page = await fetchJson<PolymarketTrade[]>(url)
      if (!page?.length)
        break
      offset += page.length
      for (const t of page) {
        if (t.side !== 'BUY')
          continue
        if (!Number.isFinite(t.price) || !Number.isFinite(t.size))
          continue
        trades.push({
          venue: 'polymarket',
          externalId: `${t.transactionHash}:${t.conditionId}:${t.outcome}`.toLowerCase(),
          marketExternalId: t.conditionId,
          side: t.outcome.toLowerCase(),
          price: t.price,
          size: t.size,
          notional: Math.round(t.size * t.price * 100) / 100,
          tradedAt: new Date(t.timestamp * 1000).toISOString(),
          trader: {
            externalId: t.proxyWallet.toLowerCase(),
            alias: t.name || t.pseudonym || '',
          },
        })
      }
    }
    return trades
  }

  async fetchMarketsByIds(externalIds: string[]): Promise<VenueMarket[]> {
    const markets: VenueMarket[] = []
    for (const batch of chunk(externalIds, 20)) {
      const ids = batch.map(id => `condition_ids=${encodeURIComponent(id)}`).join('&')
      // Gamma filters on `closed`, and by-id lookups return nothing without
      // it — query both states to cover open and resolved markets.
      for (const closed of ['false', 'true']) {
        const page = await fetchJson<GammaMarket[]>(`${GAMMA_API}/markets?${ids}&closed=${closed}`)
        for (const m of page ?? []) {
          markets.push({
            venue: 'polymarket',
            externalId: m.conditionId,
            question: m.question,
            category: m.category ?? '',
            status: m.closed
              ? (m.umaResolutionStatus === 'resolved' ? 'settled' : 'closed')
              : 'open',
            result: resolveResult(m),
            volume: m.volumeNum ?? 0,
            liquidity: m.liquidityNum ?? 0,
            lastPrice: m.lastTradePrice ?? 0,
            endsAt: m.endDate ?? '',
          })
        }
      }
    }
    return markets
  }
}
