import type { KalshiCredentials } from './credentials'
import type {
  PlaceOrderRequest,
  PlaceOrderResult,
  TradingClient,
  VenueBalance,
  VenuePosition,
} from './venue'
import { createSign } from 'node:crypto'
import { isAuthFailure, isRetryableStatus, VenueError } from './venue'

const BASE = 'https://api.elections.kalshi.com/trade-api/v2'

/**
 * Kalshi's authenticated trading API.
 *
 * Auth is a per-request RSA-PSS signature over
 * `${timestampMs}${METHOD}${path}` — note the path only, no host and no
 * query string, which is the detail that costs an afternoon if you get
 * it wrong. Salt length must equal the digest length (32 for SHA-256);
 * Node's default is different, so it is set explicitly.
 *
 * Prices cross the wire in whole cents. Everything above this file works
 * in probabilities, so the conversion lives here and nowhere else.
 */
export class KalshiTradingClient implements TradingClient {
  readonly venue = 'kalshi' as const

  constructor(private readonly credentials: KalshiCredentials) {}

  /**
   * The signature Kalshi expects.
   *
   * A bad clock is the most common cause of a 401 here — Kalshi rejects
   * timestamps outside a few seconds of its own — which is worth knowing
   * before suspecting the key.
   */
  private sign(method: string, path: string, timestamp: string): string {
    const signer = createSign('RSA-SHA256')
    signer.update(`${timestamp}${method}${path}`)
    signer.end()

    return signer.sign({
      key: this.credentials.privateKeyPem,
      padding: 6, // RSA_PKCS1_PSS_PADDING
      saltLength: 32, // digest length, per Kalshi's spec
    }, 'base64')
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const timestamp = Date.now().toString()

    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'KALSHI-ACCESS-KEY': this.credentials.apiKeyId,
        'KALSHI-ACCESS-SIGNATURE': this.sign(method, `/trade-api/v2${path}`, timestamp),
        'KALSHI-ACCESS-TIMESTAMP': timestamp,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) {
      // Kalshi returns a JSON error body; keep it verbatim rather than
      // paraphrasing, because reconciling a break needs the real text.
      const detail = await response.text().catch(() => '')
      throw new VenueError(
        `Kalshi ${method} ${path} failed (${response.status}): ${detail.slice(0, 300)}`,
        'kalshi',
        response.status,
        isRetryableStatus(response.status),
      )
    }

    return await response.json() as T
  }

  async fetchBalance(): Promise<VenueBalance> {
    // `balance` is in cents.
    const data = await this.request<{ balance: number }>('GET', '/portfolio/balance')
    return { available: (data.balance ?? 0) / 100 }
  }

  async fetchPositions(): Promise<VenuePosition[]> {
    const data = await this.request<{
      market_positions?: Array<{
        ticker: string
        position: number
        market_exposure: number
      }>
    }>('GET', '/portfolio/positions')

    const positions: VenuePosition[] = []
    for (const p of data.market_positions ?? []) {
      if (!p.position)
        continue

      // Kalshi signs the position rather than naming a side: positive is
      // long yes, negative is long no. Size is the magnitude either way.
      const size = Math.abs(p.position)
      positions.push({
        marketExternalId: p.ticker,
        side: p.position > 0 ? 'yes' : 'no',
        size,
        avgPrice: size > 0 ? Math.abs(p.market_exposure ?? 0) / 100 / size : 0,
      })
    }

    return positions
  }

  async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResult> {
    const side = request.side === 'no' ? 'no' : 'yes'
    // Kalshi prices in whole cents, so the limit has to land on one. Round
    // DOWN: rounding a buy limit up would pay more than the decision
    // authorized, which is the one direction that must never happen.
    const cents = Math.max(1, Math.min(99, Math.floor(request.limitPrice * 100)))

    const data = await this.request<{
      order: {
        order_id: string
        status: string
        taker_fill_count?: number
        taker_fill_cost?: number
      }
    }>('POST', '/portfolio/orders', {
      action: 'buy',
      client_order_id: request.clientOrderId,
      count: Math.floor(request.size),
      side,
      ticker: request.marketExternalId,
      type: 'limit',
      // Kalshi names the limit after the side being bought.
      [side === 'yes' ? 'yes_price' : 'no_price']: cents,
    })

    const filled = data.order.taker_fill_count ?? 0

    return {
      externalOrderId: data.order.order_id,
      status: normalizeStatus(data.order.status, filled, Math.floor(request.size)),
      filledSize: filled,
      avgFillPrice: filled > 0 ? (data.order.taker_fill_cost ?? 0) / 100 / filled : 0,
    }
  }

  async fetchOrder(externalOrderId: string): Promise<PlaceOrderResult | null> {
    try {
      const data = await this.request<{
        order: {
          order_id: string
          status: string
          initial_count?: number
          taker_fill_count?: number
          taker_fill_cost?: number
        }
      }>('GET', `/portfolio/orders/${encodeURIComponent(externalOrderId)}`)

      const filled = data.order.taker_fill_count ?? 0

      return {
        externalOrderId: data.order.order_id,
        status: normalizeStatus(data.order.status, filled, data.order.initial_count ?? filled),
        filledSize: filled,
        avgFillPrice: filled > 0 ? (data.order.taker_fill_cost ?? 0) / 100 / filled : 0,
      }
    }
    catch (error) {
      // A 404 means the venue never took the order — a real answer, not a
      // failure. Anything else is still a failure worth surfacing.
      if (error instanceof VenueError && error.status === 404)
        return null
      throw error
    }
  }

  async cancelOrder(externalOrderId: string): Promise<boolean> {
    try {
      await this.request('DELETE', `/portfolio/orders/${encodeURIComponent(externalOrderId)}`)
      return true
    }
    catch (error) {
      // An order that is already gone is the state the caller wanted.
      if (error instanceof VenueError && error.status === 404)
        return true
      if (error instanceof VenueError && isAuthFailure(error.status))
        throw error
      return false
    }
  }
}

/**
 * Kalshi's order statuses onto ours. `resting` is a live limit order,
 * which is 'open' here; a `canceled` order that filled part way is still
 * a partial fill and has to be reported as one or the position is lost.
 */
function normalizeStatus(status: string, filled: number, requested: number): string {
  if (filled >= requested && requested > 0)
    return 'filled'
  if (status === 'canceled' || status === 'cancelled')
    return filled > 0 ? 'partial' : 'cancelled'
  if (filled > 0)
    return 'partial'
  return 'open'
}
