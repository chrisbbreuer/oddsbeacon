import type { Database } from 'bun:sqlite'
import Sport from '../../Models/Sport'

/**
 * Keep the `sports` table matching the league list on the model.
 *
 * The seeder only populates an empty table, so a league added after the
 * first install never appears. That was fine while the list was static
 * and stopped being fine the moment the mismatch signal depended on it:
 * adding England's second, third and fourth divisions is what makes a cup
 * tie legible, and a running install would have silently kept the four
 * top flights it was seeded with.
 *
 * Reads the fixtures off the model rather than repeating them, so the
 * league list has exactly one definition. Upserts on `slug`, which is
 * uniquely indexed, and leaves `active` alone on rows that already exist
 * so an operator who turned a league off does not get it turned back on
 * by a deploy.
 */

interface SportFixture {
  slug: string
  title: string
  grouping: string
  espnPath?: string
  oddsApiKey?: string
  tier?: number
  position?: number
  active?: boolean
  nonSporting?: boolean
}

export function sportFixtures(): SportFixture[] {
  const fixtures = (Sport as any)?.traits?.useSeeder?.fixtures
  return Array.isArray(fixtures) ? fixtures as SportFixture[] : []
}

export interface SportsSyncResult {
  created: number
  updated: number
}

export function syncSports(db: Database): SportsSyncResult {
  const fixtures = sportFixtures()
  if (fixtures.length === 0)
    return { created: 0, updated: 0 }

  const now = new Date().toISOString()
  const existing = new Set(
    (db.query('SELECT slug FROM sports').all() as Array<{ slug: string }>).map(r => r.slug),
  )

  const insert = db.prepare(`
    INSERT INTO sports (slug, title, grouping, espn_path, odds_api_key, tier, position, active, non_sporting, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Everything except `active`, deliberately. A league switched off by
  // hand is an operational decision and a sync should not undo it.
  const update = db.prepare(`
    UPDATE sports SET
      title = ?, grouping = ?, espn_path = ?, odds_api_key = ?,
      tier = ?, position = ?, non_sporting = ?, updated_at = ?
    WHERE slug = ?
  `)

  let created = 0
  let updated = 0

  db.run('BEGIN')
  try {
    for (const fixture of fixtures) {
      const title = fixture.title
      const grouping = fixture.grouping
      const espnPath = fixture.espnPath ?? ''
      const oddsApiKey = fixture.oddsApiKey ?? ''
      const tier = fixture.tier ?? 0
      const position = fixture.position ?? 0
      const nonSporting = fixture.nonSporting ? 1 : 0

      if (existing.has(fixture.slug)) {
        update.run(title, grouping, espnPath, oddsApiKey, tier, position, nonSporting, now, fixture.slug)
        updated++
      }
      else {
        const active = fixture.active === false ? 0 : 1
        insert.run(fixture.slug, title, grouping, espnPath, oddsApiKey, tier, position, active, nonSporting, now, now)
        created++
      }
    }
    db.run('COMMIT')
  }
  catch (err) {
    try {
      db.run('ROLLBACK')
    }
    catch { /* the original error is the useful one */ }
    throw err
  }

  return { created, updated }
}
