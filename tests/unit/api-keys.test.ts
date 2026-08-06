/**
 * API keys: issuing, verifying, revoking, and metering.
 *
 * The security-relevant properties are the ones worth pinning, because
 * each of them is invisible when broken: a secret that is recoverable
 * from the database, a revoked key that still works, a quota that counts
 * per endpoint instead of per caller.
 */

import type { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { digest, issueKey, meter, parse, resolveKey, usageFor } from '../../app/Services/api-keys'
import { schemaFor } from '../support/schema'

const TABLES = ['api_keys', 'api_usage', 'subscriptions']

let dir: string
let db: Database

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'predicthq-keys-'))
  db = schemaFor(join(dir, 'test.sqlite'), TABLES)
  delete process.env.PRINTEL_DEV_TIER
})

afterEach(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
  delete process.env.PRINTEL_DEV_TIER
})

/**
 * Give the user a live subscription on the named tier.
 *
 * `provider_id` is unique — Stripe never reuses a subscription id — so
 * the counter is load-bearing across tests in one file.
 */
let providerSeq = 0

function subscribe(userId: number, priceKey: string): void {
  providerSeq++

  db.prepare(`
    INSERT INTO subscriptions
      (type, plan, provider_id, provider_status, provider_type, provider_price_id, unit_price, user_id, ends_at)
    VALUES ('default', ?, ?, 'active', 'stripe', ?, 0, ?, NULL)
  `).run(priceKey, `sub_${providerSeq}`, priceKey, userId)
}

describe('the key format', () => {
  it('splits a well-formed key', () => {
    expect(parse('phq_abc_secret')).toEqual({ prefix: 'abc', secret: 'secret' })
  })

  it('tolerates the Bearer prefix a client will send', () => {
    expect(parse('Bearer phq_abc_secret')).toEqual({ prefix: 'abc', secret: 'secret' })
  })

  it('refuses anything else', () => {
    expect(parse('')).toBeNull()
    expect(parse('abc')).toBeNull()
    expect(parse('phq_abc')).toBeNull()
    expect(parse('other_abc_secret')).toBeNull()
    expect(parse('phq__secret')).toBeNull()
  })
})

describe('issuing', () => {
  it('returns a usable key and stores only its digest', async () => {
    const issued = await issueKey(db as any, 1, 'ci')

    expect(issued.secret.startsWith(`phq_${issued.prefix}_`)).toBe(true)

    const row: any = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(issued.id)
    const secret = parse(issued.secret)!.secret

    // The point of the whole scheme: what is stored cannot be presented.
    expect(row.hash).toBe(digest(secret))
    expect(row.hash).not.toBe(secret)
    expect(JSON.stringify(row)).not.toContain(secret)
  })

  it('resolves the key it just issued', async () => {
    const issued = await issueKey(db as any, 7, 'ci')

    const resolved = await resolveKey(db as any, issued.secret)

    expect(resolved).not.toBeNull()
    expect(resolved!.userId).toBe(7)
  })

  it('refuses a key with the right prefix and the wrong secret', async () => {
    const issued = await issueKey(db as any, 1, 'ci')

    expect(await resolveKey(db as any, `phq_${issued.prefix}_wrong`)).toBeNull()
  })

  it('refuses a revoked key', async () => {
    const issued = await issueKey(db as any, 1, 'ci')
    db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), issued.id)

    expect(await resolveKey(db as any, issued.secret)).toBeNull()
  })

  it('refuses a key nobody issued', async () => {
    expect(await resolveKey(db as any, 'phq_deadbeef_nope')).toBeNull()
  })
})

describe('quotas', () => {
  it('follows the plan behind the account', async () => {
    subscribe(3, 'predicthq_desk_monthly')
    const issued = await issueKey(db as any, 3, 'ci')

    const resolved = await resolveKey(db as any, issued.secret)

    expect(resolved!.tier).toBe('desk')
    // Desk is unmetered, which is what a null quota means.
    expect(resolved!.dailyQuota).toBeNull()
  })

  it('gives an account with no plan a small allowance', async () => {
    const issued = await issueKey(db as any, 4, 'ci')
    const resolved = await resolveKey(db as any, issued.secret)

    expect(resolved!.tier).toBe('none')
    expect(resolved!.dailyQuota).toBe(1000)
  })
})

describe('metering', () => {
  it('counts each request against the key', async () => {
    const issued = await issueKey(db as any, 1, 'ci')
    const key = (await resolveKey(db as any, issued.secret))!

    await meter(db as any, key, '/api/v1/odds')
    const second = await meter(db as any, key, '/api/v1/odds')

    expect(second.used).toBe(2)
    expect(second.allowed).toBe(true)
  })

  it('counts the day across every endpoint', async () => {
    const issued = await issueKey(db as any, 1, 'ci')
    const key = (await resolveKey(db as any, issued.secret))!

    await meter(db as any, key, '/api/v1/odds')
    const other = await meter(db as any, key, '/api/v1/edges')

    // A per-endpoint quota would let a caller multiply their allowance
    // by however many routes we happen to have.
    expect(other.used).toBe(2)
    expect((await usageFor(db as any, key.id))).toHaveLength(2)
  })

  it('separates the days', async () => {
    const issued = await issueKey(db as any, 1, 'ci')
    const key = (await resolveKey(db as any, issued.secret))!

    await meter(db as any, key, '/api/v1/odds', new Date('2026-08-05T23:00:00.000Z'))
    const today = await meter(db as any, key, '/api/v1/odds', new Date('2026-08-06T01:00:00.000Z'))

    expect(today.used).toBe(1)
  })

  it('refuses once the allowance is spent', async () => {
    const issued = await issueKey(db as any, 1, 'ci')
    const key = { ...(await resolveKey(db as any, issued.secret))!, dailyQuota: 2 }

    expect((await meter(db as any, key, '/api/v1/odds')).allowed).toBe(true)
    expect((await meter(db as any, key, '/api/v1/odds')).allowed).toBe(true)
    expect((await meter(db as any, key, '/api/v1/odds')).allowed).toBe(false)
  })

  it('never refuses an unmetered key', async () => {
    subscribe(9, 'predicthq_desk_yearly')
    const issued = await issueKey(db as any, 9, 'ci')
    const key = (await resolveKey(db as any, issued.secret))!

    for (let i = 0; i < 5; i++)
      expect((await meter(db as any, key, '/api/v1/odds')).allowed).toBe(true)
  })

  it('records when the key was last used', async () => {
    const issued = await issueKey(db as any, 1, 'ci')
    const key = (await resolveKey(db as any, issued.secret))!

    await meter(db as any, key, '/api/v1/odds')

    const row: any = db.prepare('SELECT last_used_at FROM api_keys WHERE id = ?').get(key.id)
    expect(row.last_used_at).not.toBe('')
  })
})
