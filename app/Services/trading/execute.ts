import type { Database } from '../../Support/db'
import type { Candidate } from './evidence'
import type { TradingClient } from './venue'
import { randomUUID } from 'node:crypto'
import { log } from '@stacksjs/logging'
import { resolveEntitlements } from '../billing/entitlements'
import { openCredentials } from './credentials'
import { KalshiTradingClient } from './kalshi-trading'
import { PolymarketTradingClient } from './polymarket-trading'
import { VenueError, isAuthFailure } from './venue'

/**
 * Turning an accepted decision into an order, or refusing to.
 *
 * Every refusal is recorded on the decision with its reason. A strategy
 * that quietly does nothing is indistinguishable from one that found no
 * edge, and the difference — out of money, over the position cap, venue
 * disconnected — is exactly what a user needs to see.
 *
 * The checks run in ascending cost: strategy state, then entitlement,
 * then our own database, then the venue. The venue is asked last because
 * it is the only one that costs a round trip.
 */

export interface Strategy {
  id: number
  user_id: number
  venue: string
  bankroll: number
  max_stake: number
  min_edge: number
  min_confidence: number
  max_open_positions: number
  daily_loss_limit: number
  auto_execute: number
  status: string
}

export interface ExecutionOutcome {
  decisionId: number
  placed: boolean
  reason: string
}

/**
 * Position size from edge and confidence — a fractional Kelly stake.
 *
 * Full Kelly is the growth-optimal bet only when the probability is
 * exactly right, and ours is an estimate off a trade tape. A quarter
 * stake gives up a little growth for a lot of tolerance to being wrong
 * about fair value, which is the trade worth making here. Confidence
 * scales it again, so a thin-evidence edge sizes small rather than
 * being all-or-nothing.
 */
const KELLY_FRACTION = 0.25

export function stakeFor(candidate: Candidate, strategy: Strategy, availableBankroll: number): number {
  const price = candidate.marketPrice
  if (price <= 0 || price >= 1)
    return 0

  // Binary Kelly: edge over the odds paid. A contract bought at `price`
  // returns (1 − price) per unit staked.
  const kelly = (candidate.fairValue - price) / (1 - price)
  if (kelly <= 0)
    return 0

  const fraction = kelly * KELLY_FRACTION * candidate.confidence
  const stake = Math.min(
    availableBankroll * fraction,
    strategy.max_stake,
    availableBankroll,
  )

  return stake > 0 ? Math.floor(stake * 100) / 100 : 0
}

/** The venue client for an account, decrypting its credentials. */
export async function clientFor(sealedCredentials: string): Promise<TradingClient> {
  const credentials = await openCredentials(sealedCredentials)

  return credentials.venue === 'kalshi'
    ? new KalshiTradingClient(credentials)
    : new PolymarketTradingClient(credentials)
}

interface DecisionRow {
  id: number
  prediction_market_id: number
  venue: string
  side: string
  limit_price: number
  size: number
  notional: number
  confidence: number
  edge: number
}

interface AccountRow {
  id: number
  credentials: string
  status: string
  balance: number
}

/**
 * Execute every approved decision for a strategy.
 *
 * Returns one outcome per decision, whether or not it placed. Failures
 * are isolated per decision: a venue rejecting one order must not stop
 * the rest, because the alternative is one bad market silently
 * disabling a whole strategy.
 */
export async function executeStrategy(
  db: Database,
  strategy: Strategy,
  decisionIds: number[],
): Promise<ExecutionOutcome[]> {
  const outcomes: ExecutionOutcome[] = []

  if (decisionIds.length === 0)
    return outcomes

  const halted = await haltReason(db, strategy)
  if (halted) {
    // Halting is sticky: record it on the strategy so it survives the
    // process, and so the user sees why on the next page load.
    await db.prepare(`UPDATE trading_strategies SET status = 'halted', halted_reason = ?, updated_at = ? WHERE id = ?`)
      .run(halted, new Date().toISOString(), strategy.id)

    return await Promise.all(decisionIds.map(id => skip(db, id, halted)))
  }

  const entitlements = await resolveEntitlements(db, strategy.user_id)
  if (!entitlements.canAutoExecute)
    return await Promise.all(decisionIds.map(id => skip(db, id, `plan ${entitlements.tier} does not include automated execution`)))

  if (!strategy.auto_execute)
    return await Promise.all(decisionIds.map(id => skip(db, id, 'strategy is set to manual approval')))

  const placeholders = decisionIds.map(() => '?').join(', ')
  const decisions = await db.prepare<DecisionRow>(`
    SELECT id, prediction_market_id, venue, side, limit_price, size, notional, confidence, edge
    FROM trade_decisions
    WHERE id IN (${placeholders})
    ORDER BY confidence DESC, edge DESC
  `).all(...decisionIds)

  // Cache one client per venue: constructing a Polymarket client derives
  // an account from the private key, which is not free per order.
  const clients = new Map<string, { client: TradingClient, account: AccountRow }>()

  for (const decision of decisions) {
    const openPositions = await countOpenPositions(db, strategy.id)
    if (openPositions >= strategy.max_open_positions) {
      outcomes.push(await skip(db, decision.id, `at the ${strategy.max_open_positions}-position cap`))
      continue
    }

    const committed = await committedNotional(db, strategy.id)
    if (committed + decision.notional > strategy.bankroll) {
      outcomes.push(await skip(db, decision.id, `would commit $${round(committed + decision.notional)} against a $${round(strategy.bankroll)} bankroll`))
      continue
    }

    let resolved = clients.get(decision.venue)
    if (!resolved) {
      const account = await db.prepare<AccountRow>(`
        SELECT id, credentials, status, balance
        FROM exchange_accounts
        WHERE user_id = ? AND venue = ?
      `).get(strategy.user_id, decision.venue)

      if (!account) {
        outcomes.push(await skip(db, decision.id, `no ${decision.venue} account connected`))
        continue
      }

      if (account.status !== 'active') {
        outcomes.push(await skip(db, decision.id, `${decision.venue} account is ${account.status}`))
        continue
      }

      try {
        resolved = { client: await clientFor(account.credentials), account }
        clients.set(decision.venue, resolved)
      }
      catch (error) {
        outcomes.push(await skip(db, decision.id, error instanceof Error ? error.message : String(error)))
        continue
      }
    }

    outcomes.push(await placeOne(db, decision, resolved.client, resolved.account))
  }

  return outcomes
}

/**
 * Place one order.
 *
 * The row is written BEFORE the network call so a process that dies
 * mid-flight leaves evidence of an order that may exist at the venue.
 * Recovering from a missing row means reconciling against the venue by
 * hand; recovering from a 'pending' row is a status lookup.
 */
async function placeOne(
  db: Database,
  decision: DecisionRow,
  client: TradingClient,
  account: AccountRow,
): Promise<ExecutionOutcome> {
  const now = new Date().toISOString()
  const clientOrderId = randomUUID()

  const market = await db.prepare<{ external_id: string }>('SELECT external_id FROM prediction_markets WHERE id = ?')
    .get(decision.prediction_market_id)

  if (!market)
    return await skip(db, decision.id, 'market no longer in our database')

  const insert = await db.prepare(`
    INSERT INTO exchange_orders (
      trade_decision_id, exchange_account_id, venue, client_order_id, external_order_id,
      market_external_id, side, limit_price, size, filled_size, avg_fill_price,
      status, error, placed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, 0, 0, 'pending', '', ?, ?, ?)
  `).run(
    decision.id,
    account.id,
    decision.venue,
    clientOrderId,
    market.external_id,
    decision.side,
    decision.limit_price,
    decision.size,
    now,
    now,
    now,
  )

  const orderId = Number(insert.lastInsertRowid)

  try {
    const result = await client.placeOrder({
      marketExternalId: market.external_id,
      side: decision.side,
      limitPrice: decision.limit_price,
      size: decision.size,
      clientOrderId,
    })

    await db.prepare(`
      UPDATE exchange_orders
      SET external_order_id = ?, status = ?, filled_size = ?, avg_fill_price = ?, updated_at = ?
      WHERE id = ?
    `).run(result.externalOrderId, result.status, result.filledSize, result.avgFillPrice, new Date().toISOString(), orderId)

    await db.prepare(`UPDATE trade_decisions SET status = 'executed', status_reason = '', updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), decision.id)

    return { decisionId: decision.id, placed: true, reason: result.status }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    await db.prepare(`UPDATE exchange_orders SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`)
      .run(message.slice(0, 500), new Date().toISOString(), orderId)

    await db.prepare(`UPDATE trade_decisions SET status = 'failed', status_reason = ?, updated_at = ? WHERE id = ?`)
      .run(message.slice(0, 300), new Date().toISOString(), decision.id)

    // Credentials the venue no longer accepts will fail every subsequent
    // order too. Mark the account so the next pass stops before the
    // network instead of burning a round trip per decision.
    if (error instanceof VenueError && isAuthFailure(error.status)) {
      await db.prepare(`UPDATE exchange_accounts SET status = 'revoked', last_error = ?, updated_at = ? WHERE id = ?`)
        .run(message.slice(0, 300), new Date().toISOString(), account.id)
      log.warn(`[trading] ${decision.venue} rejected our credentials; account ${account.id} marked revoked`)
    }

    return { decisionId: decision.id, placed: false, reason: message }
  }
}

/**
 * Why this strategy must not trade right now, or '' if it may.
 *
 * The daily loss check is deliberately on realized losses from filled
 * orders rather than marked-to-market exposure: a limit that trips on an
 * unrealized swing halts a strategy for a price move that has not cost
 * anything yet.
 */
async function haltReason(db: Database, strategy: Strategy): Promise<string> {
  if (strategy.status === 'halted')
    return 'strategy is halted'
  if (strategy.status !== 'active')
    return `strategy is ${strategy.status}`

  if (strategy.daily_loss_limit > 0) {
    const startOfDay = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`

    const row = await db.prepare<{ spent: number }>(`
      SELECT COALESCE(SUM(o.filled_size * o.avg_fill_price), 0) AS spent
      FROM exchange_orders o
      JOIN trade_decisions d ON d.id = o.trade_decision_id
      WHERE d.trading_strategy_id = ?
        AND o.status IN ('filled', 'partial')
        AND o.placed_at >= ?
    `).get(strategy.id, startOfDay)

    if (Number(row?.spent ?? 0) >= strategy.daily_loss_limit)
      return `daily loss limit reached ($${round(Number(row?.spent ?? 0))} of $${round(strategy.daily_loss_limit)} at risk today)`
  }

  return ''
}

/** Orders still live or filled and unsettled, for the position cap. */
async function countOpenPositions(db: Database, strategyId: number): Promise<number> {
  const row = await db.prepare<{ n: number }>(`
    SELECT COUNT(*) AS n
    FROM exchange_orders o
    JOIN trade_decisions d ON d.id = o.trade_decision_id
    WHERE d.trading_strategy_id = ? AND o.status IN ('pending', 'open', 'partial', 'filled')
  `).get(strategyId)

  return Number(row?.n ?? 0)
}

/** Notional already committed, against which the bankroll is checked. */
async function committedNotional(db: Database, strategyId: number): Promise<number> {
  const row = await db.prepare<{ total: number }>(`
    SELECT COALESCE(SUM(o.limit_price * o.size), 0) AS total
    FROM exchange_orders o
    JOIN trade_decisions d ON d.id = o.trade_decision_id
    WHERE d.trading_strategy_id = ? AND o.status IN ('pending', 'open', 'partial', 'filled')
  `).get(strategyId)

  return Number(row?.total ?? 0)
}

async function skip(db: Database, decisionId: number, reason: string): Promise<ExecutionOutcome> {
  await db.prepare(`UPDATE trade_decisions SET status = 'skipped', status_reason = ?, updated_at = ? WHERE id = ?`)
    .run(reason.slice(0, 300), new Date().toISOString(), decisionId)

  return { decisionId, placed: false, reason }
}

function round(value: number): string {
  return value.toFixed(2)
}
