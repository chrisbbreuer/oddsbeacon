import { rmSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'bun:test'
import { assessScheduleEdge, loadScheduleContext, type ScheduleContext } from '../../app/Services/quant/schedule'
import { schemaFor } from '../support/schema'

/**
 * Rest and congestion.
 *
 * The property that matters most is not the arithmetic, it is that a
 * fixture never counts itself. A query using `<=` instead of `<` would
 * fold the game being priced into its own history, which is a leak that
 * backtests beautifully and fails live, and it would do so silently.
 */

const paths: string[] = []

function freshDb() {
  const path = `tests/temp/schedule-${paths.length}-${Bun.nanoseconds()}.sqlite`
  paths.push(path)
  const db = schemaFor(path, ['sports', 'sports_teams', 'market_events'])
  db.run(`INSERT INTO sports (id, slug, title, grouping, tier, active, position) VALUES (1, 'nba', 'NBA', 'Basketball', 1, 1, 1)`)
  for (const [id, name] of [[1, 'Home'], [2, 'Away'], [3, 'Other']] as const) {
    db.run(
      `INSERT INTO sports_teams (id, sport_id, name, search_key, aliases, created_at, updated_at) VALUES (?, 1, ?, ?, '', '', '')`,
      [id, name, name.toLowerCase()],
    )
  }
  return db
}

afterEach(() => {
  for (const path of paths.splice(0)) {
    for (const suffix of ['', '-shm', '-wal'])
      rmSync(`${path}${suffix}`, { force: true })
  }
})

/** Days relative to a fixed anchor, so the fixtures read plainly. */
const ANCHOR = Date.parse('2026-03-10T00:00:00.000Z')
function day(offset: number): string {
  return new Date(ANCHOR + offset * 86_400_000).toISOString()
}

function addGame(db: ReturnType<typeof freshDb>, id: number, homeId: number, awayId: number, at: string) {
  db.run(
    `INSERT INTO market_events (id, sport_id, title, commence_at, status, home_sports_team_id, away_sports_team_id)
     VALUES (?, 1, 'game', ?, 'scheduled', ?, ?)`,
    [id, at, homeId, awayId],
  )
}

function ctx(overrides: Partial<ScheduleContext> = {}): ScheduleContext {
  return { teamId: 1, restDays: null, gamesInWindow: 0, backToBack: false, ...overrides }
}

describe('loadScheduleContext', () => {
  it('measures rest from the previous fixture', async () => {
    const db = freshDb()
    addGame(db, 1, 1, 3, day(0))
    addGame(db, 2, 1, 2, day(3))

    expect((await loadScheduleContext(db, 1, day(3))).restDays).toBe(3)
  })

  it('never counts the fixture being priced as its own history', async () => {
    const db = freshDb()
    addGame(db, 1, 1, 2, day(5))

    // The only fixture on file IS the one being priced. Counting it would
    // report zero rest and a game already played.
    const context = await loadScheduleContext(db, 1, day(5))

    expect(context.restDays).toBeNull()
    expect(context.gamesInWindow).toBe(0)
  })

  it('counts games inside the congestion window and not before it', async () => {
    const db = freshDb()
    addGame(db, 1, 1, 3, day(0))
    addGame(db, 2, 3, 1, day(2))
    addGame(db, 3, 1, 3, day(4))
    addGame(db, 4, 1, 3, day(-20)) // long before the window
    addGame(db, 5, 1, 2, day(5))

    expect((await loadScheduleContext(db, 1, day(5))).gamesInWindow).toBe(3)
  })

  it('counts a fixture whether the team was home or away', async () => {
    const db = freshDb()
    addGame(db, 1, 3, 1, day(1)) // team 1 away
    addGame(db, 2, 1, 2, day(2))

    expect((await loadScheduleContext(db, 1, day(2))).restDays).toBe(1)
  })

  it('flags a back-to-back', async () => {
    const db = freshDb()
    addGame(db, 1, 1, 3, day(0))
    addGame(db, 2, 1, 2, day(1))

    expect((await loadScheduleContext(db, 1, day(1))).backToBack).toBe(true)
  })

  it('does not flag two nights apart as a back-to-back', async () => {
    const db = freshDb()
    addGame(db, 1, 1, 3, day(0))
    addGame(db, 2, 1, 2, day(2))

    expect((await loadScheduleContext(db, 1, day(2))).backToBack).toBe(false)
  })

  it('is safe on a team with no history at all', async () => {
    const db = freshDb()
    const context = await loadScheduleContext(db, 2, day(0))

    expect(context.restDays).toBeNull()
    expect(context.gamesInWindow).toBe(0)
    expect(context.backToBack).toBe(false)
  })
})

describe('assessScheduleEdge', () => {
  it('says nothing without history on both sides', () => {
    expect(assessScheduleEdge(ctx({ restDays: 3 }), ctx()).edge).toBe(0)
    expect(assessScheduleEdge(ctx(), ctx()).confidence).toBe(0)
  })

  it('favours the better-rested side', () => {
    const result = assessScheduleEdge(ctx({ restDays: 3 }), ctx({ restDays: 1 }))

    expect(result.edge).toBeGreaterThan(0)
    expect(result.reasons[0]).toContain('Rest')
  })

  it('is symmetric', () => {
    const a = assessScheduleEdge(ctx({ restDays: 3 }), ctx({ restDays: 1 }))
    const b = assessScheduleEdge(ctx({ restDays: 1 }), ctx({ restDays: 3 }))

    expect(a.edge).toBeCloseTo(-b.edge, 6)
  })

  it('ignores a rest gap of under a day', () => {
    expect(assessScheduleEdge(ctx({ restDays: 2.2 }), ctx({ restDays: 2 })).edge).toBe(0)
  })

  it('treats a long break as rest, not as ever-increasing freshness', () => {
    // Eight days against four is not twice as good as four against two.
    const long = assessScheduleEdge(ctx({ restDays: 10 }), ctx({ restDays: 4 }))
    const capped = assessScheduleEdge(ctx({ restDays: 4 }), ctx({ restDays: 4 }))

    expect(long.edge).toBe(capped.edge)
  })

  it('penalises the side on a back-to-back', () => {
    const result = assessScheduleEdge(
      ctx({ restDays: 1, backToBack: true }),
      ctx({ restDays: 3, backToBack: false }),
    )

    expect(result.edge).toBeLessThan(0)
    expect(result.reasons.some(r => r.includes('back-to-back'))).toBe(true)
  })

  it('reads a congestion gap only when it is worth reading', () => {
    expect(assessScheduleEdge(ctx({ gamesInWindow: 3 }), ctx({ gamesInWindow: 4 })).edge).toBe(0)

    const heavy = assessScheduleEdge(ctx({ gamesInWindow: 1 }), ctx({ gamesInWindow: 4 }))
    expect(heavy.edge).toBeGreaterThan(0)
  })

  it('stays within the bounds it promises', () => {
    const extreme = assessScheduleEdge(
      ctx({ restDays: 14, gamesInWindow: 0, backToBack: false }),
      ctx({ restDays: 0, gamesInWindow: 9, backToBack: true }),
    )

    expect(extreme.edge).toBeLessThanOrEqual(1)
    expect(extreme.confidence).toBeLessThanOrEqual(1)
  })
})
