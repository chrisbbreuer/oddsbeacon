import type Stripe from 'stripe'
import { Database } from 'bun:sqlite'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { constructEventAsync } from '@stacksjs/payments/billable/webhook'
import { response } from '@stacksjs/router'
import { databasePath } from '../../Services/trading/run'

/**
 * POST /api/billing/webhook — Stripe's view of a subscription, applied.
 *
 * This is what makes entitlements honest. `entitlements.ts` reads the
 * subscriptions table on every trading pass rather than calling Stripe,
 * which is only safe because this endpoint keeps the table current — a
 * webhook that silently stops working leaves a cancelled customer
 * placing real-money orders indefinitely.
 *
 * Three properties it has to have:
 *
 *   Verified — the signature is checked against the endpoint secret
 *   before anything is read. An unverified body is an attacker naming
 *   their own subscription tier.
 *
 *   Idempotent — Stripe retries, and out of order. Writes are upserts
 *   keyed on the Stripe subscription id, so a replayed event converges
 *   instead of duplicating a row that `entitlementsFor` would then count
 *   twice.
 *
 *   Honest about failure — a handler that throws must NOT return 2xx.
 *   Stripe stops retrying on a 2xx, so swallowing an error here is how
 *   local state silently diverges and never recovers.
 */
export default {
  name: 'SubscriptionWebhook',
  description: 'Apply Stripe subscription lifecycle events to the local subscriptions table.',

  async handle(request?: {
    header?: (key: string) => string | undefined
    rawBody?: () => Promise<string> | string
    body?: string
  }) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) {
      log.error('[billing] STRIPE_WEBHOOK_SECRET is not set; refusing to process an unverifiable webhook')
      return response.error('Webhook processing is not configured.', 500)
    }

    const signature = request?.header?.('stripe-signature') ?? ''
    if (!signature)
      return response.error('Missing stripe-signature header.', 400)

    // The signature covers the exact bytes Stripe sent, so this has to be
    // the raw body — a re-serialized JSON object will not verify.
    const payload = typeof request?.rawBody === 'function'
      ? await request.rawBody()
      : request?.body ?? ''

    if (!payload)
      return response.error('Empty webhook body.', 400)

    let event: Stripe.Event
    try {
      event = await constructEventAsync(payload, signature, secret)
    }
    catch (error) {
      // Never log the payload of a failed verification: it is unattested
      // input, and it is the one place a forged body would be recorded.
      log.warn(`[billing] rejected a webhook with an invalid signature: ${error instanceof Error ? error.message : 'unknown'}`)
      return response.error('Invalid signature.', 400)
    }

    const db = new Database(databasePath())

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          applySubscription(db, event.data.object as Stripe.Subscription, event.type)
          break

        default:
          // Everything else is an event we do not model. Acknowledging it
          // is correct — Stripe should not retry an event nobody wants.
          return { received: true, handled: false, type: event.type }
      }

      return { received: true, handled: true, type: event.type }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error(`[billing] failed to apply ${event.type}: ${message}`)

      // Non-2xx so Stripe retries. The alternative is a subscription
      // change we dropped and will never see again.
      return response.error('Failed to apply the event.', 500)
    }
    finally {
      db.close()
    }
  },
}

/**
 * Upsert one subscription.
 *
 * `provider_id` is the Stripe subscription id and is unique in our
 * schema, which is what makes a retried or out-of-order event converge
 * on the same row rather than adding a second one.
 */
function applySubscription(db: Database, subscription: Stripe.Subscription, eventType: string): void {
  const userId = resolveUserId(db, subscription)
  if (!userId) {
    // A subscription we cannot attribute is worth surfacing loudly — it
    // means a customer paid and got nothing, which no retry will fix.
    log.error(`[billing] subscription ${subscription.id} has no matching local user (customer ${String(subscription.customer)})`)
    return
  }

  const item = subscription.items?.data?.[0]
  const priceId = item?.price?.id ?? ''
  // The lookup key is what config/saas.ts names a plan, and what
  // `tierFrom` matches on. The raw price id is a Stripe identifier that
  // says nothing about the tier, so prefer the key and fall back only if
  // the price was created without one.
  const planKey = item?.price?.lookup_key ?? priceId

  // A deletion event carries the subscription in whatever state it ended
  // in; force the status so a race with a stale `updated` cannot leave it
  // looking live.
  const status = eventType === 'customer.subscription.deleted'
    ? 'canceled'
    : subscription.status

  const endsAt = subscription.cancel_at
    ? new Date(subscription.cancel_at * 1000).toISOString()
    : subscription.ended_at
      ? new Date(subscription.ended_at * 1000).toISOString()
      : null

  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null

  db.prepare(`
    INSERT INTO subscriptions (
      type, plan, provider_id, provider_status, provider_type, provider_price_id,
      unit_price, quantity, trial_ends_at, ends_at, last_used_at, user_id
    ) VALUES ('default', ?, ?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (provider_id) DO UPDATE SET
      plan = excluded.plan,
      provider_status = excluded.provider_status,
      provider_price_id = excluded.provider_price_id,
      unit_price = excluded.unit_price,
      quantity = excluded.quantity,
      trial_ends_at = excluded.trial_ends_at,
      ends_at = excluded.ends_at,
      last_used_at = excluded.last_used_at,
      user_id = excluded.user_id
  `).run(
    planKey,
    subscription.id,
    status,
    priceId,
    (item?.price?.unit_amount ?? 0) / 100,
    item?.quantity ?? 1,
    trialEndsAt,
    endsAt,
    new Date().toISOString(),
    userId,
  )

  log.info(`[billing] subscription ${subscription.id} for user ${userId} is now ${status} on ${planKey}`)
}

/**
 * Which local user this subscription belongs to.
 *
 * Stripe metadata is the reliable answer because we set it when the
 * checkout session is created. The customer-id lookup is the fallback
 * for subscriptions created outside our own checkout — through the
 * Stripe dashboard, say — which would otherwise be unattributable.
 */
function resolveUserId(db: Database, subscription: Stripe.Subscription): number | null {
  const fromMetadata = Number(subscription.metadata?.user_id ?? 0)
  if (fromMetadata > 0)
    return fromMetadata

  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id

  if (!customerId)
    return null

  const row = db.prepare('SELECT id FROM users WHERE stripe_id = ?')
    .get(customerId) as { id: number } | null

  return row?.id ?? null
}
