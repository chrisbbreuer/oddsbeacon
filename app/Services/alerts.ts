import type { Database } from '../Support/db'
import { config } from '@stacksjs/config'
import { mail } from '@stacksjs/email'
import { log } from '@stacksjs/logging'
import { useDatabase } from '@stacksjs/notifications'

/**
 * Getting an alert to the person who asked for it.
 *
 * Alerts fired into a public realtime channel and a row against user
 * zero, which reaches whoever has the page open and nobody else. The
 * moment an alert is worth something is the moment the user is not
 * looking, so delivery has to go where they are — and to only the people
 * who asked, or it is noise that trains them to ignore the useful ones.
 *
 * Every send is recorded in `notification_deliveries` whether it
 * succeeded or not. A user who says they never got an alert and a system
 * that cannot say whether it sent one is an argument nobody can win.
 */

/**
 * The quiet period between deliveries to one subscription.
 *
 * Arbitrages arrive in bursts — one mispriced market produces several
 * within a minute — and a subscription that fires on each of them sends
 * a dozen emails about the same thing. One every quarter hour is still
 * timely for an edge that lasts minutes.
 */
const COOLDOWN_MINUTES = 15

export interface Alertable {
  kind: string
  /** League or category, matched against a subscription's allowlist. */
  league: string
  venue: string
  /** Profit or edge in percentage points, matched against the floor. */
  value: number
  title: string
  body: string
  data: Record<string, unknown>
}

export interface DeliverySummary {
  matched: number
  delivered: number
  failed: number
}

interface SubscriptionRow {
  id: number
  user_id: number
  leagues: string
  venue: string
  min_value: number
  channels: string
  last_sent_at: string | null
}

/**
 * Deliver one alert to everyone subscribed to it.
 *
 * Failures are per subscriber. One user's dead email address must not
 * stop the alert reaching anybody else, and it must not fail the
 * ingestion pass that produced the alert either — the pass is worth more
 * than the notification.
 */
export async function deliverAlert(db: Database, alert: Alertable, now: Date = new Date()): Promise<DeliverySummary> {
  const summary: DeliverySummary = { matched: 0, delivered: 0, failed: 0 }

  const subscriptions = await db.prepare<SubscriptionRow>(`
    SELECT id, user_id, leagues, venue, min_value, channels, last_sent_at
    FROM alert_subscriptions
    WHERE kind = ? AND active = 1
    ORDER BY id
  `).all(alert.kind)

  for (const subscription of subscriptions) {
    if (!matches(subscription, alert))
      continue
    if (withinCooldown(subscription.last_sent_at, now))
      continue

    summary.matched++

    const channels = (subscription.channels || 'database')
      .split(',')
      .map(channel => channel.trim().toLowerCase())
      .filter(Boolean)

    let anyDelivered = false

    for (const channel of channels) {
      const sent = channel === 'email'
        ? await sendEmail(db, subscription.user_id, alert)
        : await sendInApp(db, subscription.user_id, alert)

      if (sent) {
        anyDelivered = true
        summary.delivered++
      }
      else {
        summary.failed++
      }
    }

    // The cooldown starts when something actually went out. Stamping it
    // on a failed send would silence the subscription for the next
    // quarter hour on the strength of a delivery that never happened.
    if (anyDelivered) {
      await db.prepare('UPDATE alert_subscriptions SET last_sent_at = ?, updated_at = ? WHERE id = ?')
        .run(now.toISOString(), now.toISOString(), subscription.id)
    }
  }

  return summary
}

/**
 * Whether this subscription asked for this alert.
 *
 * An empty allowlist means every league, which is the sane reading of a
 * filter nobody filled in — the alternative is a subscription that
 * matches nothing and looks broken.
 */
export function matches(subscription: Pick<SubscriptionRow, 'leagues' | 'venue' | 'min_value'>, alert: Alertable): boolean {
  if (alert.value < Number(subscription.min_value ?? 0))
    return false

  const venue = (subscription.venue || 'both').toLowerCase()
  if (venue !== 'both' && alert.venue && venue !== alert.venue.toLowerCase())
    return false

  const leagues = (subscription.leagues || '')
    .split(',')
    .map(league => league.trim().toLowerCase())
    .filter(Boolean)

  if (leagues.length === 0)
    return true

  return leagues.includes((alert.league || '').toLowerCase())
}

function withinCooldown(lastSentAt: string | null, now: Date): boolean {
  if (!lastSentAt)
    return false

  const last = Date.parse(lastSentAt)
  if (!Number.isFinite(last))
    return false

  return now.getTime() - last < COOLDOWN_MINUTES * 60_000
}

/** A row in the user's notification list. */
async function sendInApp(db: Database, userId: number, alert: Alertable): Promise<boolean> {
  try {
    await useDatabase().send({ userId, type: alert.kind, data: alert.data })
    await recordDelivery(db, userId, 'database', String(userId), alert, 'sent', '')
    return true
  }
  catch (error) {
    await recordDelivery(db, userId, 'database', String(userId), alert, 'failed', message(error))
    return false
  }
}

/**
 * An email, to the address on the account.
 *
 * A user with no address is not a failure to report — there is nothing
 * wrong and nothing to send — so it is recorded as a skipped delivery
 * rather than counted against the alert.
 */
async function sendEmail(db: Database, userId: number, alert: Alertable): Promise<boolean> {
  const user = await db.prepare<{ email: string }>('SELECT email FROM users WHERE id = ?').get(userId)
  const address = user?.email ?? ''

  if (!address) {
    await recordDelivery(db, userId, 'email', '', alert, 'failed', 'the account has no email address')
    return false
  }

  try {
    const appName = config.app.name || 'PredictHQ'

    await mail.send({
      to: [address],
      from: {
        name: config.email.from?.name || appName,
        address: config.email.from?.address || 'hello@stacksjs.com',
      },
      subject: alert.title,
      text: alert.body,
    })

    await recordDelivery(db, userId, 'email', address, alert, 'sent', '')
    return true
  }
  catch (error) {
    await recordDelivery(db, userId, 'email', address, alert, 'failed', message(error))
    log.warn(`[alerts] could not email ${alert.kind} to user ${userId}: ${message(error)}`)
    return false
  }
}

async function recordDelivery(
  db: Database,
  userId: number,
  channel: string,
  recipient: string,
  alert: Alertable,
  status: string,
  error: string,
): Promise<void> {
  const now = new Date().toISOString()

  try {
    await db.prepare(`
      INSERT INTO notification_deliveries (
        user_id, channel, recipient, subject, body, status, error, metadata, sent_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      channel,
      recipient,
      alert.title.slice(0, 255),
      alert.body,
      status,
      error.slice(0, 500),
      JSON.stringify(alert.data).slice(0, 4000),
      status === 'sent' ? now : null,
      now,
      now,
    )
  }
  catch (failure) {
    log.warn(`[alerts] could not record a ${channel} delivery for user ${userId}: ${message(failure)}`)
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
