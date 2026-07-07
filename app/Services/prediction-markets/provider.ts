/**
 * Shared shapes for the prediction-market ingestion pipeline. Both venues
 * (Kalshi, Polymarket) normalize their public data into these before the
 * ingest action persists anything, so the storage layer never needs
 * venue-specific branches.
 */

/** Normalized market snapshot from a venue's public API. */
export interface VenueMarket {
  venue: 'kalshi' | 'polymarket'
  externalId: string
  question: string
  category: string
  /** 'open' | 'closed' | 'settled' */
  status: string
  /** Winning side once settled ('yes' | 'no' | outcome label), '' before. */
  result: string
  volume: number
  liquidity: number
  /** Last traded probability for the yes side, 0..1. */
  lastPrice: number
  endsAt: string
}

/** Normalized public fill. Trader is present only where the venue exposes identity. */
export interface VenueTrade {
  venue: 'kalshi' | 'polymarket'
  externalId: string
  marketExternalId: string
  /** Side the taker bought: 'yes' | 'no' | outcome label (lowercased). */
  side: string
  /** Fill probability price, 0..1. */
  price: number
  size: number
  notional: number
  tradedAt: string
  trader?: {
    externalId: string
    alias: string
  }
}

export interface PredictionMarketProvider {
  readonly name: string
  /** Latest public fills, newest first. */
  fetchTrades: (limit: number) => Promise<VenueTrade[]>
  /** Market snapshots for specific external ids (status/result refresh). */
  fetchMarketsByIds: (externalIds: string[]) => Promise<VenueMarket[]>
}

/** GET a JSON url with a hard timeout; null on any network/parse failure. */
export async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok)
      return null
    return await res.json() as T
  }
  catch {
    return null
  }
}

/** Split `items` into chunks of at most `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size))
  return out
}
