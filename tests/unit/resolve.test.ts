import { afterEach, describe, expect, it } from 'bun:test'
import { rmSync } from 'node:fs'
import { resolveEvent, resolveMarket, resolveSelection, resolveTeam } from '../../app/Services/ingest/resolve'
import { schemaFor } from '../support/schema'

/**
 * Identity resolution, pinned against the failure it was written to fix.
 *
 * The old ingestion matched incoming prices to stored rows by normalized
 * selection *label*, globally. That both collided (every event has a
 * "Home") and failed to match (the feed says "Los Angeles Lakers", the row
 * said "Lakers"), and it announced neither. These tests assert the two
 * properties that matter: the same thing seen twice resolves to one row,
 * and two different things never collapse into one.
 */

const TABLES = [
  'sports', 'sports_teams', 'market_events', 'markets', 'selections',
  'event_results', 'event_sources', 'bookmakers', 'odds', 'odds_snapshots',
]

const paths: string[] = []

function freshDb() {
  const path = `tests/temp/resolve-${paths.length}-${Bun.nanoseconds()}.sqlite`
  paths.push(path)
  const db = schemaFor(path, TABLES)
  db.run(`INSERT INTO sports (id, slug, title, grouping, active, position) VALUES (1, 'mlb', 'MLB', 'Baseball', 1, 1)`)
  return db
}

afterEach(() => {
  for (const path of paths.splice(0)) {
    for (const suffix of ['', '-shm', '-wal'])
      rmSync(`${path}${suffix}`, { force: true })
  }
})

describe('resolveTeam', () => {
  it('returns the same row for the same name', async () => {
    const db = freshDb()
    const a = await resolveTeam(db, 1, 'Baltimore Orioles')
    const b = await resolveTeam(db, 1, 'Baltimore Orioles')
    expect(a).toBe(b!)
    db.close()
  })

  it('ignores punctuation and casing', async () => {
    const db = freshDb()
    const a = await resolveTeam(db, 1, 'St. Louis Cardinals')
    const b = await resolveTeam(db, 1, 'st louis cardinals')
    expect(a).toBe(b!)
    db.close()
  })

  it('matches a near-identical spelling and learns it as an alias', async () => {
    const db = freshDb()
    // Matching requires the nickname *and* most of the qualifier to
    // agree, which a feed still carrying a club's former name satisfies.
    const current = await resolveTeam(db, 1, 'Tampa Bay Rays')
    const former = await resolveTeam(db, 1, 'Tampa Bay Devil Rays')
    expect(former).toBe(current!)

    // The spelling is written back, so the next occurrence is an indexed
    // hit rather than another scan.
    const row = db.query('SELECT aliases FROM sports_teams WHERE id = ?').get(current) as { aliases: string }
    expect(row.aliases).toContain('tampabaydevilrays')
    db.close()
  })

  it('reuses a learned alias without re-running the fuzzy pass', async () => {
    const db = freshDb()
    const full = await resolveTeam(db, 1, 'Los Angeles Angels')
    db.run('UPDATE sports_teams SET aliases = ? WHERE id = ?', ['laangels', full])

    expect(await resolveTeam(db, 1, 'LA Angels')).toBe(full!)
    db.close()
  })

  it('refuses an ambiguous match rather than risking a wrong merge', async () => {
    // "LA Angels" shares only its nickname with "Los Angeles Angels" and
    // scores below the bar, so a second row is created. That is the
    // intended trade: the same score would merge "Georgia Bulldogs" with
    // "Butler Bulldogs", and college leagues reuse nicknames heavily.
    // A duplicate team is visible and fixable; a wrong merge silently
    // misattributes every price, result, and grade that follows.
    const db = freshDb()
    const full = await resolveTeam(db, 1, 'Los Angeles Angels')
    expect(await resolveTeam(db, 1, 'LA Angels')).not.toBe(full!)
    db.close()
  })

  it('keeps two colleges sharing a nickname apart', async () => {
    const db = freshDb()
    expect(await resolveTeam(db, 1, 'Georgia Bulldogs')).not.toBe(await resolveTeam(db, 1, 'Butler Bulldogs'))
    db.close()
  })

  it('keeps two clubs from the same city apart', async () => {
    // "Los Angeles Lakers" and "Los Angeles Clippers" share two of three
    // tokens. A naive overlap score merges them; weighting the nickname is
    // what stops it, and a wrong merge silently misattributes every price,
    // result, and grade that follows.
    const db = freshDb()
    const lakers = await resolveTeam(db, 1, 'Los Angeles Lakers')
    const clippers = await resolveTeam(db, 1, 'Los Angeles Clippers')
    expect(lakers).not.toBe(clippers!)
    db.close()
  })

  it('scopes teams to their sport', async () => {
    const db = freshDb()
    db.run(`INSERT INTO sports (id, slug, title, grouping, active, position) VALUES (2, 'nba', 'NBA', 'Basketball', 1, 2)`)
    expect(await resolveTeam(db, 1, 'Giants')).not.toBe(await resolveTeam(db, 2, 'Giants'))
    db.close()
  })
})

describe('resolveEvent', () => {
  const base = {
    sportId: 1,
    title: 'Away at Home',
    commenceAt: '2026-08-04T22:35:00.000Z',
  }

  it('is idempotent on the provider id', async () => {
    const db = freshDb()
    const a = await resolveEvent(db, { ...base, provider: 'espn', externalId: 'e1' })
    const b = await resolveEvent(db, { ...base, provider: 'espn', externalId: 'e1' })

    expect(a.created).toBe(true)
    expect(b.created).toBe(false)
    expect(a.eventId).toBe(b.eventId)
    db.close()
  })

  it('links a second provider onto the same event via the team pair', async () => {
    const db = freshDb()
    const home = await resolveTeam(db, 1, 'Baltimore Orioles')
    const away = await resolveTeam(db, 1, 'Los Angeles Angels')

    const espn = await resolveEvent(db, { ...base, provider: 'espn', externalId: 'e1', homeTeamId: home, awayTeamId: away })
    // The odds feed reports the same game with its own id and a start time
    // a few minutes off, which is normal disagreement between feeds.
    const odds = await resolveEvent(db, {
      ...base,
      provider: 'the-odds-api',
      externalId: 'x9',
      commenceAt: '2026-08-04T22:40:00.000Z',
      homeTeamId: home,
      awayTeamId: away,
    })

    expect(odds.eventId).toBe(espn.eventId)
    expect(odds.created).toBe(false)
    db.close()
  })

  it('keeps consecutive games between the same two clubs apart', async () => {
    // A baseball series is three or four straight meetings of the same
    // pair. A day-wide match window merges them into one event, which is
    // exactly what happened before the window was tightened.
    const db = freshDb()
    const home = await resolveTeam(db, 1, 'Baltimore Orioles')
    const away = await resolveTeam(db, 1, 'Los Angeles Angels')

    const monday = await resolveEvent(db, { ...base, provider: 'espn', externalId: 'g1', commenceAt: '2026-08-04T22:35:00.000Z', homeTeamId: home, awayTeamId: away })
    const tuesday = await resolveEvent(db, { ...base, provider: 'espn', externalId: 'g2', commenceAt: '2026-08-05T22:35:00.000Z', homeTeamId: home, awayTeamId: away })

    expect(tuesday.eventId).not.toBe(monday.eventId)
    expect(tuesday.created).toBe(true)
    db.close()
  })

  it('never merges two ids from the same provider', async () => {
    // Within one provider its own ids are authoritative: a different id is
    // a different game, whatever the teams and kickoff say.
    const db = freshDb()
    const home = await resolveTeam(db, 1, 'Baltimore Orioles')
    const away = await resolveTeam(db, 1, 'Los Angeles Angels')

    const first = await resolveEvent(db, { ...base, provider: 'espn', externalId: 'g1', homeTeamId: home, awayTeamId: away })
    const second = await resolveEvent(db, { ...base, provider: 'espn', externalId: 'g2', homeTeamId: home, awayTeamId: away })

    expect(second.eventId).not.toBe(first.eventId)
    db.close()
  })
})

describe('resolveMarket and resolveSelection', () => {
  async function seedEvent(db: ReturnType<typeof freshDb>) {
    return (await resolveEvent(db, {
      sportId: 1,
      provider: 'espn',
      externalId: 'e1',
      title: 'Away at Home',
      commenceAt: '2026-08-04T22:35:00.000Z',
    })).eventId
  }

  it('is idempotent for a market with no line', async () => {
    // The unique index keys on `line_key` rather than the nullable `line`
    // for exactly this case: SQL treats NULLs as distinct, so a nullable
    // column in a unique index constrains nothing and every pass would
    // insert a fresh duplicate moneyline.
    const db = freshDb()
    const eventId = await seedEvent(db)

    const a = await resolveMarket(db, { eventId, marketType: 'h2h', line: null })
    const b = await resolveMarket(db, { eventId, marketType: 'h2h', line: null })

    expect(a).toBe(b)
    expect((db.query('SELECT COUNT(*) AS n FROM markets').get() as { n: number }).n).toBe(1)
    db.close()
  })

  it('treats two lines on the same bet type as different markets', async () => {
    const db = freshDb()
    const eventId = await seedEvent(db)

    const half = await resolveMarket(db, { eventId, marketType: 'totals', line: 8.5 })
    const nine = await resolveMarket(db, { eventId, marketType: 'totals', line: 9 })

    expect(half).not.toBe(nine)
    db.close()
  })

  it('is idempotent for a selection with no point', async () => {
    const db = freshDb()
    const marketId = await resolveMarket(db, { eventId: await seedEvent(db), marketType: 'h2h', line: null })

    const a = await resolveSelection(db, { marketId, label: 'Baltimore Orioles', side: 'home', point: null })
    const b = await resolveSelection(db, { marketId, label: 'Baltimore Orioles', side: 'home', point: null })

    expect(a).toBe(b)
    db.close()
  })

  it('identifies a selection by side, not by label', async () => {
    // The label is what a feed calls the outcome and it varies between
    // feeds and over time; the side is the closed vocabulary grading
    // switches on. Keying on the label is the original bug.
    const db = freshDb()
    const marketId = await resolveMarket(db, { eventId: await seedEvent(db), marketType: 'h2h', line: null })

    const first = await resolveSelection(db, { marketId, label: 'Baltimore Orioles', side: 'home', point: null })
    const renamed = await resolveSelection(db, { marketId, label: 'Orioles', side: 'home', point: null })

    expect(renamed).toBe(first)
    const row = db.query('SELECT label FROM selections WHERE id = ?').get(first) as { label: string }
    expect(row.label).toBe('Orioles')
    db.close()
  })

  it('keeps two sides of the same market apart', async () => {
    const db = freshDb()
    const marketId = await resolveMarket(db, { eventId: await seedEvent(db), marketType: 'h2h', line: null })

    const home = await resolveSelection(db, { marketId, label: 'Home', side: 'home', point: null })
    const away = await resolveSelection(db, { marketId, label: 'Away', side: 'away', point: null })

    expect(home).not.toBe(away)
    db.close()
  })
})
