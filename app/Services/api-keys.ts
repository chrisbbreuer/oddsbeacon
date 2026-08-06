import type { Database } from '../Support/db'
import type { Tier } from './billing/entitlements'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { resolveEntitlements } from './billing/entitlements'

/**
 * Naming the caller.
 *
 * The public API was rate limited by IP, which is the only thing an
 * anonymous request offers and a bad proxy for a caller: it throttles a
 * whole office sharing one address and lets one caller with a handful of
 * addresses past. The bulk export made that concrete — five thousand
 * rows a request, to anyone, with no record of who or how much.
 *
 * A key is issued to an account, so its quota can follow the plan that
 * account pays for, and its usage can be reported back to the person
 * responsible for it.
 */

/** The whole key: `phq_<prefix>_<secret>`. */
const PREFIX_BYTES = 8
const SECRET_BYTES = 24

/**
 * Requests per UTC day, by plan.
 *
 * An unkeyed caller is not represented here: they keep the existing
 * per-IP throttle and are simply not metered. The point of a quota is to
 * be attached to a plan, and a caller with no account has no plan.
 */
const DAILY_QUOTA: Record<Tier, number | null> = {
  none: 1_000,
  signal: 25_000,
  auto: 100_000,
  desk: null,
}

export interface IssuedKey {
  id: number
  prefix: string
  /** The only time the full key exists outside the caller's hands. */
  secret: string
}

export interface ResolvedKey {
  id: number
  userId: number
  prefix: string
  tier: Tier
  /** Null means unmetered. */
  dailyQuota: number | null
}

/**
 * Mint a key for a user.
 *
 * The secret is returned once and never stored. What is stored is its
 * digest, which is enough to check a presented key and not enough to
 * reconstruct one — so a database that leaks does not hand out API
 * access along with everything else.
 */
export async function issueKey(db: Database, userId: number, name: string): Promise<IssuedKey> {
  const prefix = randomBytes(PREFIX_BYTES).toString('hex')
  const secret = randomBytes(SECRET_BYTES).toString('base64url')
  const now = new Date().toISOString()

  const insert = await db.prepare(`
    INSERT INTO api_keys (user_id, name, prefix, hash, last_used_at, revoked_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, '', '', ?, ?)
  `).run(userId, name.slice(0, 80), prefix, digest(secret), now, now)

  return {
    id: Number(insert.lastInsertRowid),
    prefix,
    secret: `phq_${prefix}_${secret}`,
  }
}

/**
 * Identify the key a request presented, or null.
 *
 * The prefix selects the row and the digest comparison decides, in
 * constant time: a comparison that returns early on the first wrong byte
 * tells an attacker how much of a guess was right, and a key is exactly
 * the kind of secret worth guessing a byte at a time.
 */
export async function resolveKey(db: Database, presented: string): Promise<ResolvedKey | null> {
  const parsed = parse(presented)
  if (!parsed)
    return null

  const row = await db.prepare<{ id: number, user_id: number, hash: string, revoked_at: string | null }>(
    'SELECT id, user_id, hash, revoked_at FROM api_keys WHERE prefix = ?',
  ).get(parsed.prefix)

  if (!row || row.revoked_at)
    return null

  if (!sameDigest(row.hash, digest(parsed.secret)))
    return null

  const entitlements = await resolveEntitlements(db, row.user_id)

  return {
    id: row.id,
    userId: row.user_id,
    prefix: parsed.prefix,
    tier: entitlements.tier,
    dailyQuota: DAILY_QUOTA[entitlements.tier],
  }
}

/**
 * Count one request against a key, and say whether it was over quota.
 *
 * Counted before the answer is served rather than after. A request that
 * fails downstream still cost us the work, and a meter that only counts
 * successes is one an abusive caller can drive to zero by asking for
 * things that break.
 */
export async function meter(
  db: Database,
  key: ResolvedKey,
  endpoint: string,
  now: Date = new Date(),
): Promise<{ used: number, allowed: boolean }> {
  const day = now.toISOString().slice(0, 10)
  const timestamp = now.toISOString()

  // Insert-or-ignore, never update-or-insert: the second form would
  // write `requests = 0` over an existing bucket on every call, so the
  // counter would sit at one forever and the quota would never bind.
  // The unique index on the three columns is what makes the ignore safe
  // against two requests arriving together.
  await db.insertOrIgnore('api_usage', {
    api_key_id: key.id,
    day,
    endpoint,
    requests: 0,
    created_at: timestamp,
    updated_at: timestamp,
  })

  await db.prepare(
    'UPDATE api_usage SET requests = requests + 1, updated_at = ? WHERE api_key_id = ? AND day = ? AND endpoint = ?',
  ).run(timestamp, key.id, day, endpoint)

  await db.prepare('UPDATE api_keys SET last_used_at = ?, updated_at = ? WHERE id = ?')
    .run(timestamp, timestamp, key.id)

  // The quota is across every endpoint, so the total is what decides —
  // a per-endpoint limit would let a caller multiply their allowance by
  // the number of routes we happen to have.
  const total = await db.prepare<{ used: number }>(
    'SELECT COALESCE(SUM(requests), 0) AS used FROM api_usage WHERE api_key_id = ? AND day = ?',
  ).get(key.id, day)

  const used = Number(total?.used ?? 0)

  return {
    used,
    allowed: key.dailyQuota === null || used <= key.dailyQuota,
  }
}

/** Usage for one key over the last `days` UTC days, newest first. */
export async function usageFor(db: Database, apiKeyId: number, days = 30): Promise<Array<{ day: string, endpoint: string, requests: number }>> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

  return await db.prepare<{ day: string, endpoint: string, requests: number }>(`
    SELECT day, endpoint, requests
    FROM api_usage
    WHERE api_key_id = ? AND day >= ?
    ORDER BY day DESC, requests DESC
  `).all(apiKeyId, since)
}

/**
 * `phq_<prefix>_<secret>` split into its halves, or null if malformed.
 *
 * Split on the first separator after the prefix rather than on every
 * one. The secret is base64url, whose alphabet includes the underscore,
 * so a plain split rejects roughly two keys in three — which reads as a
 * key that was issued and then never worked.
 */
export function parse(presented: string): { prefix: string, secret: string } | null {
  const trimmed = presented.trim().replace(/^Bearer\s+/i, '')
  if (!trimmed.startsWith('phq_'))
    return null

  const rest = trimmed.slice('phq_'.length)
  const separator = rest.indexOf('_')
  if (separator <= 0)
    return null

  const prefix = rest.slice(0, separator)
  const secret = rest.slice(separator + 1)

  return prefix && secret ? { prefix, secret } : null
}

export function digest(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/** Constant-time comparison of two hex digests. */
function sameDigest(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')

  // timingSafeEqual throws on a length mismatch, which would itself leak
  // the answer through an exception rather than a return value.
  if (left.length !== right.length || left.length === 0)
    return false

  return timingSafeEqual(left, right)
}
