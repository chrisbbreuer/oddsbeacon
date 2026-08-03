import { Database } from 'bun:sqlite'
import process from 'node:process'

/**
 * What a user's subscription lets them do.
 *
 * One question answered in one place. The executor asks it before every
 * order and the API asks it before arming a strategy, and both have to
 * get the same answer — a user who can arm a strategy the executor then
 * refuses to run has a product that silently does nothing.
 *
 * Reads the subscriptions table directly rather than calling Stripe: the
 * trading loop runs every few minutes and a payment provider is not
 * something to put on that path. The webhook is what keeps the table
 * honest; a lapsed subscription stops entitling within one webhook, and
 * `ends_at` covers the window between cancellation and period end.
 */

export type Tier = 'none' | 'signal' | 'auto' | 'desk'

export interface Entitlements {
  tier: Tier
  /** May the executor place real orders for this user. */
  canAutoExecute: boolean
  /** Null means unlimited. */
  maxStrategies: number | null
  /** May candidates be sent for model judgement. */
  canUseDeepResearch: boolean
}

const NONE: Entitlements = {
  tier: 'none',
  canAutoExecute: false,
  maxStrategies: 0,
  canUseDeepResearch: false,
}

const BY_TIER: Record<Exclude<Tier, 'none'>, Entitlements> = {
  signal: { tier: 'signal', canAutoExecute: false, maxStrategies: 1, canUseDeepResearch: false },
  auto: { tier: 'auto', canAutoExecute: true, maxStrategies: 5, canUseDeepResearch: true },
  desk: { tier: 'desk', canAutoExecute: true, maxStrategies: null, canUseDeepResearch: true },
}

/**
 * Stripe statuses that mean the subscription is live.
 *
 * `past_due` is deliberately absent. A failed payment on an account that
 * places real money orders should stop placing them, not keep going on
 * the assumption the card recovers.
 */
const LIVE_STATUSES = new Set(['active', 'trialing'])

interface SubscriptionRow {
  plan: string | null
  provider_price_id: string | null
  provider_status: string | null
  ends_at: string | null
}

export function entitlementsFor(db: Database, userId: number): Entitlements {
  const rows = db.prepare(`
    SELECT plan, provider_price_id, provider_status, ends_at
    FROM subscriptions
    WHERE user_id = ?
  `).all(userId) as SubscriptionRow[]

  const now = Date.now()
  let best: Entitlements = NONE

  for (const row of rows) {
    if (!LIVE_STATUSES.has(row.provider_status ?? ''))
      continue

    // A cancelled-but-not-yet-expired subscription still entitles until
    // the period it was paid for actually ends.
    if (row.ends_at) {
      const endsAt = Date.parse(row.ends_at)
      if (Number.isFinite(endsAt) && endsAt < now)
        continue
    }

    const tier = tierFrom(row.provider_price_id ?? row.plan ?? '')
    if (tier === 'none')
      continue

    // Someone holding two subscriptions gets the better one rather than
    // whichever the query happened to return first.
    if (rank(tier) > rank(best.tier))
      best = BY_TIER[tier]
  }

  return best
}

/**
 * Map a price key onto a tier.
 *
 * The keys in config/saas.ts are `predicthq_<tier>_<cadence>`, so the tier
 * is the middle segment. Matching on substrings instead of an exact list
 * means adding a cadence does not require touching this file.
 */
export function tierFrom(priceKey: string): Tier {
  const key = priceKey.toLowerCase()
  if (key.includes('desk'))
    return 'desk'
  if (key.includes('auto'))
    return 'auto'
  if (key.includes('signal'))
    return 'signal'
  return 'none'
}

function rank(tier: Tier): number {
  return { none: 0, signal: 1, auto: 2, desk: 3 }[tier]
}

/**
 * Single-user development mode.
 *
 * A local checkout has no Stripe and no webhook, so without this every
 * trading command is dead on arrival and the feature cannot be worked on
 * at all. Explicitly opt-in through an env var, and never in production:
 * the guard is the whole point of the file.
 */
export function developmentOverride(): Entitlements | null {
  if (process.env.APP_ENV === 'production')
    return null
  if (process.env.PRINTEL_DEV_TIER === undefined)
    return null

  const tier = tierFrom(process.env.PRINTEL_DEV_TIER)
  return tier === 'none' ? null : BY_TIER[tier]
}

/** Entitlements with the development override applied, if one is set. */
export function resolveEntitlements(db: Database, userId: number): Entitlements {
  return developmentOverride() ?? entitlementsFor(db, userId)
}
