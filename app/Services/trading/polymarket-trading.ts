import type { PolymarketCredentials } from './credentials'
import type {
  PlaceOrderRequest,
  PlaceOrderResult,
  TradingClient,
  VenueBalance,
  VenuePosition,
} from './venue'
import { createHmac } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'
import { isRetryableStatus, VenueError } from './venue'

const CLOB = 'https://clob.polymarket.com'
const DATA_API = 'https://data-api.polymarket.com'

/** Polygon mainnet — the chain the CTF exchange settles on. */
const CHAIN_ID = 137
/** Polymarket's CTF Exchange, the verifying contract for order signatures. */
const EXCHANGE_ADDRESS = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const

/**
 * The EIP-712 order struct the exchange verifies. Field order is part of
 * the type hash, so it is not free to reorder — a rearranged struct
 * produces a signature the contract rejects with no useful explanation.
 */
const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
} as const

/** USDC has 6 decimals; every amount on the wire is an integer of those. */
const USDC_DECIMALS = 1_000_000

/**
 * Polymarket's CLOB.
 *
 * Two independent signatures are in play and conflating them is the
 * usual source of confusion:
 *
 *   L2 — an HMAC over the request, proving the API key trio. Transport
 *        auth only; it lets you read and submit.
 *   L1 — an EIP-712 signature over the order struct, made with the
 *        wallet's own key. This is what actually authorizes moving
 *        funds, and the exchange contract verifies it on chain.
 *
 * A request can pass L2 and still be rejected because L1 is wrong, which
 * reads as a generic 400 unless you know to look for it.
 */
export class PolymarketTradingClient implements TradingClient {
  readonly venue = 'polymarket' as const

  private readonly account: ReturnType<typeof privateKeyToAccount>

  constructor(private readonly credentials: PolymarketCredentials) {
    this.account = privateKeyToAccount(credentials.privateKey as `0x${string}`)
  }

  /**
   * L2 headers. The signature covers `timestamp + METHOD + path + body`
   * under an HMAC keyed by the base64url-decoded API secret — decoded,
   * not the literal string, which is easy to miss.
   */
  private authHeaders(method: string, path: string, body?: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const message = `${timestamp}${method}${path}${body ?? ''}`

    const signature = createHmac('sha256', Buffer.from(this.credentials.apiSecret, 'base64url'))
      .update(message)
      .digest('base64url')

    return {
      'POLY_ADDRESS': this.account.address,
      'POLY_SIGNATURE': signature,
      'POLY_TIMESTAMP': timestamp,
      'POLY_API_KEY': this.credentials.apiKey,
      'POLY_PASSPHRASE': this.credentials.apiPassphrase,
      'Content-Type': 'application/json',
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const payload = body === undefined ? undefined : JSON.stringify(body)

    const response = await fetch(`${CLOB}${path}`, {
      method,
      headers: this.authHeaders(method, path, payload),
      body: payload,
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new VenueError(
        `Polymarket ${method} ${path} failed (${response.status}): ${detail.slice(0, 300)}`,
        'polymarket',
        response.status,
        isRetryableStatus(response.status),
      )
    }

    return await response.json() as T
  }

  async fetchBalance(): Promise<VenueBalance> {
    const data = await this.request<{ balance?: string }>(
      'GET',
      `/balance-allowance?asset_type=COLLATERAL&signature_type=1`,
    )
    return { available: Number(data.balance ?? 0) / USDC_DECIMALS }
  }

  async fetchPositions(): Promise<VenuePosition[]> {
    // Positions come from the public data API keyed by the proxy wallet,
    // not the CLOB — the CLOB only knows about orders.
    const url = `${DATA_API}/positions?user=${encodeURIComponent(this.credentials.funderAddress)}&sizeThreshold=0.01`
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })

    if (!response.ok) {
      throw new VenueError(
        `Polymarket positions failed (${response.status})`,
        'polymarket',
        response.status,
        isRetryableStatus(response.status),
      )
    }

    const rows = await response.json() as Array<{
      asset?: string
      outcome?: string
      size?: number
      avgPrice?: number
    }>

    return rows
      .filter(r => r.asset && (r.size ?? 0) > 0)
      .map(r => ({
        marketExternalId: r.asset!,
        side: (r.outcome ?? '').toLowerCase(),
        size: r.size ?? 0,
        avgPrice: r.avgPrice ?? 0,
      }))
  }

  async placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResult> {
    // A BUY pays USDC to receive outcome shares: makerAmount is what we
    // spend, takerAmount what we get. Both are integers of the token's
    // smallest unit, so the price is expressed by their ratio rather
    // than sent as a field of its own.
    const takerAmount = BigInt(Math.floor(request.size * USDC_DECIMALS))
    const makerAmount = BigInt(Math.floor(request.size * request.limitPrice * USDC_DECIMALS))

    const order = {
      // The salt only has to be unique per order. Deriving it from our
      // own client order id keeps a retry byte-identical, so the
      // exchange sees one order instead of two.
      salt: BigInt(saltFrom(request.clientOrderId)),
      maker: this.credentials.funderAddress as `0x${string}`,
      signer: this.account.address,
      // The zero address leaves the order open to any taker.
      taker: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      tokenId: BigInt(request.marketExternalId),
      makerAmount,
      takerAmount,
      // 0 means good-til-cancelled.
      expiration: 0n,
      nonce: 0n,
      feeRateBps: 0n,
      side: 0, // 0 = BUY
      // 1 = POLY_PROXY: the order is signed by an EOA on behalf of the
      // proxy wallet that actually holds the funds.
      signatureType: 1,
    }

    const signature = await this.account.signTypedData({
      domain: {
        name: 'Polymarket CTF Exchange',
        version: '1',
        chainId: CHAIN_ID,
        verifyingContract: EXCHANGE_ADDRESS,
      },
      types: ORDER_TYPES,
      primaryType: 'Order',
      message: order,
    })

    const data = await this.request<{
      success?: boolean
      orderID?: string
      errorMsg?: string
      status?: string
      makingAmount?: string
      takingAmount?: string
    }>('POST', '/order', {
      order: {
        ...serializeOrder(order),
        signature,
      },
      owner: this.credentials.apiKey,
      // GTC: rest on the book rather than cancelling what does not fill
      // immediately, which is the right shape for a limit price derived
      // from a fair value rather than a chase.
      orderType: 'GTC',
    })

    // A 200 with success:false is a rejection — the CLOB reports order
    // validation failures in the body, not the status line.
    if (data.success === false) {
      throw new VenueError(
        `Polymarket rejected the order: ${data.errorMsg ?? 'no reason given'}`,
        'polymarket',
        400,
        false,
      )
    }

    const filledSize = Number(data.takingAmount ?? 0) / USDC_DECIMALS
    const filledCost = Number(data.makingAmount ?? 0) / USDC_DECIMALS

    return {
      externalOrderId: data.orderID ?? '',
      status: normalizeStatus(data.status, filledSize, request.size),
      filledSize,
      avgFillPrice: filledSize > 0 ? filledCost / filledSize : 0,
    }
  }

  async fetchOrder(externalOrderId: string): Promise<PlaceOrderResult | null> {
    try {
      const data = await this.request<{
        id?: string
        status?: string
        original_size?: string
        size_matched?: string
        price?: string
      }>('GET', `/data/order/${encodeURIComponent(externalOrderId)}`)

      const filledSize = Number(data.size_matched ?? 0)

      return {
        externalOrderId: data.id ?? externalOrderId,
        status: normalizeStatus(data.status, filledSize, Number(data.original_size ?? filledSize)),
        filledSize,
        avgFillPrice: Number(data.price ?? 0),
      }
    }
    catch (error) {
      if (error instanceof VenueError && error.status === 404)
        return null
      throw error
    }
  }

  async cancelOrder(externalOrderId: string): Promise<boolean> {
    try {
      await this.request('DELETE', '/order', { orderID: externalOrderId })
      return true
    }
    catch (error) {
      if (error instanceof VenueError && error.status === 404)
        return true
      return false
    }
  }
}

/** Every bigint in the struct has to be a decimal string on the wire. */
function serializeOrder(order: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(order))
    out[key] = typeof value === 'bigint' ? value.toString() : value
  return out
}

/**
 * A deterministic uint from our client order id.
 *
 * FNV-1a over the id, kept well inside Number.MAX_SAFE_INTEGER so the
 * BigInt conversion is exact. Determinism is the point: the same
 * decision retried produces the same salt, so the same signed order.
 */
function saltFrom(clientOrderId: string): number {
  let hash = 0x811C9DC5
  for (let i = 0; i < clientOrderId.length; i++) {
    hash ^= clientOrderId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

/**
 * The CLOB's statuses onto ours. `matched` and `live` are the two that
 * matter: matched means it crossed, live means it is resting.
 */
function normalizeStatus(status: string | undefined, filled: number, requested: number): string {
  if (requested > 0 && filled >= requested)
    return 'filled'
  if (status === 'canceled' || status === 'cancelled')
    return filled > 0 ? 'partial' : 'cancelled'
  if (filled > 0)
    return 'partial'
  return 'open'
}
