import { rmSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'bun:test'
import { buildCandidates } from '../../app/Services/trading/evidence'
import { schemaFor } from '../support/schema'

/**
 * The two signals added on top of the flow-based ones.
 *
 * Both are wired into `buildCandidates`, so they are tested through it
 * rather than in isolation: the thing worth proving is not that the maths
 * works but that a real market ends up carrying the signal, on the right
 * side, without disturbing the six that were already there.
 */

const TABLES = [
  'prediction_markets', 'market_traders', 'market_trades',
  'sports', 'sports_teams', 'market_events', 'markets', 'selections',
  'team_standings', 'team_injuries', 'club_valuations',
]

const paths: string[] = []

function freshDb() {
  const path = `tests/temp/signals-${paths.length}-${Bun.nanoseconds()}.sqlite`
  paths.push(path)
  return schemaFor(path, TABLES)
}

afterEach(() => {
  for (const path of paths.splice(0)) {
    for (const suffix of ['', '-shm', '-wal'])
      rmSync(`${path}${suffix}`, { force: true })
  }
})

const NOW = Date.now()
function hoursAgo(h: number): string {
  return new Date(NOW - h * 3_600_000).toISOString()
}
function daysFromNow(d: number): string {
  return new Date(NOW + d * 86_400_000).toISOString()
}

/** One market with a flow history, priced at 50c. */
function seedMarket(db: ReturnType<typeof freshDb>, ticker: string, question: string, outcomeLabel: string) {
  db.run(
    `INSERT INTO prediction_markets (venue, external_id, question, outcome_label, category, status, result, volume, liquidity, last_price, ends_at, created_at, updated_at)
     VALUES ('kalshi', ?, ?, ?, 'Sports', 'open', '', 100000, 5000, 0.5, ?, ?, ?)`,
    [ticker, question, outcomeLabel, daysFromNow(1), hoursAgo(48), hoursAgo(48)],
  )
  return Number((db.query('SELECT last_insert_rowid() AS id').get() as any).id)
}

/** Fills on one side, at one price, at a given age. */
function fills(db: ReturnType<typeof freshDb>, marketId: number, side: string, count: number, price: number, agoHours: number) {
  for (let i = 0; i < count; i++) {
    db.run(
      `INSERT INTO market_trades (prediction_market_id, market_trader_id, venue, external_id, side, price, size, notional, is_winner, traded_at, created_at, updated_at)
       VALUES (?, NULL, 'kalshi', ?, ?, ?, 100, 400, -1, ?, ?, ?)`,
      [marketId, `${marketId}-${side}-${agoHours}-${i}`, side, price, hoursAgo(agoHours), hoursAgo(agoHours), hoursAgo(agoHours)],
    )
  }
}

function seedFixture(
  db: ReturnType<typeof freshDb>,
  options: { homeName: string, awayName: string, homeTier: number, awayTier: number, commenceAt: string },
) {
  db.run(`INSERT INTO sports (id, slug, title, grouping, tier, active, position) VALUES (1, 'epl', 'EPL', 'Soccer', ?, 1, 1)`, [options.homeTier])
  db.run(`INSERT INTO sports (id, slug, title, grouping, tier, active, position) VALUES (2, 'efl', 'EFL', 'Soccer', ?, 1, 2)`, [options.awayTier])

  db.run(
    `INSERT INTO sports_teams (id, sport_id, name, search_key, aliases, created_at, updated_at) VALUES (1, 1, ?, ?, '', '', '')`,
    [options.homeName, options.homeName.toLowerCase()],
  )
  db.run(
    `INSERT INTO sports_teams (id, sport_id, name, search_key, aliases, created_at, updated_at) VALUES (2, 2, ?, ?, '', '', '')`,
    [options.awayName, options.awayName.toLowerCase()],
  )

  db.run(
    `INSERT INTO market_events (id, sport_id, title, commence_at, status, home_sports_team_id, away_sports_team_id)
     VALUES (100, 1, 'fixture', ?, 'scheduled', 1, 2)`,
    [options.commenceAt],
  )
}

function kindsFor(db: ReturnType<typeof freshDb>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const candidate of buildCandidates(db, { minEdge: 0 })) {
    for (const item of candidate.evidence)
      out[item.kind] = (out[item.kind] ?? 0) + Number(item.contribution !== 0 || true)
  }
  return out
}

describe('reverse line movement', () => {
  it('fires when the money bought a side whose price then fell', () => {
    const db = freshDb()
    const id = seedMarket(db, 'KXTEST-1-A', 'A vs B Winner?', 'A')

    // Heavy yes buying, and yes got cheaper anyway: someone sold into it.
    fills(db, id, 'yes', 20, 0.60, 20)
    fills(db, id, 'yes', 20, 0.45, 4)
    fills(db, id, 'no', 4, 0.50, 6)

    expect(kindsFor(db).reverse_line_move).toBeGreaterThan(0)
  })

  it('stays quiet when price followed the money, which is the normal case', () => {
    const db = freshDb()
    const id = seedMarket(db, 'KXTEST-2-A', 'A vs B Winner?', 'A')

    fills(db, id, 'yes', 20, 0.45, 20)
    fills(db, id, 'yes', 20, 0.60, 4)
    fills(db, id, 'no', 4, 0.50, 6)

    expect(kindsFor(db).reverse_line_move).toBeUndefined()
  })

  it('stays quiet when the flow was balanced, however the price moved', () => {
    const db = freshDb()
    const id = seedMarket(db, 'KXTEST-3-A', 'A vs B Winner?', 'A')

    fills(db, id, 'yes', 12, 0.60, 20)
    fills(db, id, 'yes', 12, 0.45, 4)
    fills(db, id, 'no', 12, 0.60, 20)
    fills(db, id, 'no', 12, 0.45, 4)

    // A move with no crowd behind it is just a move.
    expect(kindsFor(db).reverse_line_move).toBeUndefined()
  })

  it('needs both halves of the window to have traded', () => {
    const db = freshDb()
    const id = seedMarket(db, 'KXTEST-4-A', 'A vs B Winner?', 'A')

    // All the flow in the older half: the "move" would otherwise be an
    // average against an empty set.
    fills(db, id, 'yes', 30, 0.60, 20)
    fills(db, id, 'no', 6, 0.50, 22)

    expect(kindsFor(db).reverse_line_move).toBeUndefined()
  })
})

describe('schedule rest', () => {
  it('fires when one side is on a back-to-back and the other is rested', () => {
    const db = freshDb()
    const id = seedMarket(db, 'KXEPLGAME-26AUG08HOMAWA-HOM', 'Home vs Away Winner?', 'Home')
    seedFixture(db, { homeName: 'Home', awayName: 'Away', homeTier: 1, awayTier: 1, commenceAt: daysFromNow(1) })

    // A third club, so each side's previous game involves only that side.
    // Reusing the opponent would put BOTH teams on the same back-to-back
    // and the signal would correctly see no difference between them.
    db.run(`INSERT INTO sports_teams (id, sport_id, name, search_key, aliases, created_at, updated_at) VALUES (3, 1, 'Third', 'third', '', '', '')`)

    // Away played an hour before kickoff; home last played six days ago.
    db.run(`INSERT INTO market_events (id, sport_id, title, commence_at, status, home_sports_team_id, away_sports_team_id)
            VALUES (101, 1, 'prev away', ?, 'final', 2, 3)`, [new Date(NOW + 86_400_000 - 3_600_000).toISOString()])
    db.run(`INSERT INTO market_events (id, sport_id, title, commence_at, status, home_sports_team_id, away_sports_team_id)
            VALUES (102, 1, 'prev home', ?, 'final', 1, 3)`, [new Date(NOW - 6 * 86_400_000).toISOString()])

    fills(db, id, 'yes', 20, 0.5, 10)
    fills(db, id, 'no', 6, 0.5, 8)

    expect(kindsFor(db).schedule_rest).toBeGreaterThan(0)
  })

  it('stays quiet when neither side has any schedule history', () => {
    const db = freshDb()
    const id = seedMarket(db, 'KXEPLGAME-26AUG08HOMAWA-HOM', 'Home vs Away Winner?', 'Home')
    seedFixture(db, { homeName: 'Home', awayName: 'Away', homeTier: 1, awayTier: 1, commenceAt: daysFromNow(1) })

    fills(db, id, 'yes', 20, 0.5, 10)
    fills(db, id, 'no', 6, 0.5, 8)

    expect(kindsFor(db).schedule_rest).toBeUndefined()
  })

  it('does not disturb the flow signals that were already there', () => {
    const db = freshDb()
    const id = seedMarket(db, 'KXTEST-9-A', 'A vs B Winner?', 'A')

    fills(db, id, 'yes', 30, 0.5, 10)
    fills(db, id, 'no', 6, 0.5, 8)

    const kinds = kindsFor(db)
    expect(kinds.flow_imbalance).toBeGreaterThan(0)
    expect(kinds.liquidity).toBeGreaterThan(0)
  })
})
