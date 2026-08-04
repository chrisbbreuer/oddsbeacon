import { afterEach, describe, expect, it } from 'bun:test'
import { rmSync } from 'node:fs'
import { gradeSelections } from '../../app/Services/quant/settle'
import { schemaFor } from '../support/schema'

/**
 * Grading is the step that turns opinions into a record, so it has to be
 * right in the cases that are easy to get wrong: pushes, draws, the sign
 * of a handicap, and voided games.
 *
 * These run against a real schema built from the real migrations rather
 * than a mock, because several of the guarantees under test come from
 * constraints rather than from code.
 */

const TABLES = [
  'sports', 'sports_teams', 'market_events', 'markets', 'selections',
  'event_results', 'bookmakers', 'odds', 'odds_snapshots', 'closing_lines',
  'fair_prices', 'feature_snapshots',
]

const paths: string[] = []

function freshDb() {
  const path = `tests/temp/settle-${paths.length}-${Bun.nanoseconds()}.sqlite`
  paths.push(path)
  return schemaFor(path, TABLES)
}

afterEach(() => {
  for (const path of paths.splice(0)) {
    for (const suffix of ['', '-shm', '-wal'])
      rmSync(`${path}${suffix}`, { force: true })
  }
})

/**
 * Build one finished event with its markets and selections, then grade it.
 *
 * Markets are explicit rather than one-per-selection: both sides of a
 * spread belong to the *same* market at the same line, which is what the
 * unique index on (event, type, line, period) enforces.
 */
function seedEvent(
  db: ReturnType<typeof freshDb>,
  result: { home: number, away: number, winner: string, completed?: number },
  markets: Array<{ type: string, line: number | null, sides: Array<{ side: string, point: number | null }> }>,
) {
  db.run(`INSERT INTO sports (id, slug, title, grouping, active, position) VALUES (1, 'nba', 'NBA', 'Basketball', 1, 1)`)
  db.run(`INSERT INTO market_events (id, sport_id, title, commence_at, status) VALUES (1, 1, 'A at B', '2026-01-01T00:00:00.000Z', 'final')`)
  db.run(
    `INSERT INTO event_results (market_event_id, home_score, away_score, winner_side, completed, source, settled_at, graded_at)
     VALUES (1, ?, ?, ?, ?, 'test', '2026-01-01T03:00:00.000Z', '')`,
    [result.home, result.away, result.winner, result.completed ?? 1],
  )

  let selectionId = 0
  markets.forEach((m, i) => {
    const marketId = i + 1
    db.run(
      `INSERT INTO markets (id, market_event_id, market_type, line, line_key, period, complete, status, position)
       VALUES (?, 1, ?, ?, ?, 'full_game', 1, 'open', ?)`,
      [marketId, m.type, m.line, m.line === null ? '' : String(m.line), i],
    )
    for (const s of m.sides) {
      selectionId++
      db.run(
        `INSERT INTO selections (id, market_id, label, side, point, point_key, position, outcome, graded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, -1, '')`,
        [selectionId, marketId, s.side, s.side, s.point, s.point === null ? '' : String(s.point), selectionId],
      )
    }
  })
}

function outcomes(db: ReturnType<typeof freshDb>): number[] {
  return (db.query('SELECT outcome FROM selections ORDER BY id').all() as Array<{ outcome: number }>)
    .map(r => r.outcome)
}

describe('gradeSelections — moneyline', () => {
  it('settles the winner and the loser', () => {
    const db = freshDb()
    seedEvent(db, { home: 110, away: 100, winner: 'home' }, [
      { type: 'h2h', line: null, sides: [{ side: 'home', point: null }, { side: 'away', point: null }] },
    ])

    expect(gradeSelections(db).selections).toBe(2)
    expect(outcomes(db)).toEqual([1, 0])
    db.close()
  })

  it('settles a draw to the draw selection', () => {
    const db = freshDb()
    seedEvent(db, { home: 1, away: 1, winner: 'draw' }, [
      { type: 'h2h', line: null, sides: [
        { side: 'home', point: null },
        { side: 'draw', point: null },
        { side: 'away', point: null },
      ] },
    ])

    gradeSelections(db)
    expect(outcomes(db)).toEqual([0, 1, 0])
    db.close()
  })
})

describe('gradeSelections — spreads', () => {
  it('applies the handicap to the side that carries it', () => {
    // Home wins by 10. Home -4.5 covers; away +4.5 does not.
    const db = freshDb()
    seedEvent(db, { home: 110, away: 100, winner: 'home' }, [
      { type: 'spreads', line: -4.5, sides: [{ side: 'home', point: -4.5 }, { side: 'away', point: 4.5 }] },
    ])

    gradeSelections(db)
    expect(outcomes(db)).toEqual([1, 0])
    db.close()
  })

  it('settles a favourite that wins but fails to cover', () => {
    // Home wins by 3 as a 6.5-point favourite: the bet loses despite the
    // team winning, which is the case a naive winner-based grade gets wrong.
    const db = freshDb()
    seedEvent(db, { home: 103, away: 100, winner: 'home' }, [
      { type: 'spreads', line: -6.5, sides: [{ side: 'home', point: -6.5 }, { side: 'away', point: 6.5 }] },
    ])

    gradeSelections(db)
    expect(outcomes(db)).toEqual([0, 1])
    db.close()
  })

  it('pushes when the margin lands exactly on the line', () => {
    // Home wins by 7 at -7. Stake returned: neither a win nor a loss.
    const db = freshDb()
    seedEvent(db, { home: 107, away: 100, winner: 'home' }, [
      { type: 'spreads', line: -7, sides: [{ side: 'home', point: -7 }, { side: 'away', point: 7 }] },
    ])

    gradeSelections(db)
    expect(outcomes(db)).toEqual([2, 2])
    db.close()
  })
})

describe('gradeSelections — totals', () => {
  it('settles over and under against the combined score', () => {
    const db = freshDb()
    seedEvent(db, { home: 110, away: 105, winner: 'home' }, [
      { type: 'totals', line: 210.5, sides: [{ side: 'over', point: 210.5 }, { side: 'under', point: 210.5 }] },
    ])

    gradeSelections(db)
    expect(outcomes(db)).toEqual([1, 0])
    db.close()
  })

  it('pushes on an exact total', () => {
    const db = freshDb()
    seedEvent(db, { home: 110, away: 105, winner: 'home' }, [
      { type: 'totals', line: 215, sides: [{ side: 'over', point: 215 }, { side: 'under', point: 215 }] },
    ])

    gradeSelections(db)
    expect(outcomes(db)).toEqual([2, 2])
    db.close()
  })
})

describe('gradeSelections — voided games', () => {
  it('pushes every market when the game did not complete', () => {
    // An abandoned game determined no outcome, so nothing may be graded a
    // loss — the stake goes back regardless of the score at the time.
    const db = freshDb()
    seedEvent(db, { home: 50, away: 40, winner: 'home', completed: 0 }, [
      { type: 'h2h', line: null, sides: [{ side: 'home', point: null }] },
      { type: 'spreads', line: -4.5, sides: [{ side: 'home', point: -4.5 }] },
      { type: 'totals', line: 80.5, sides: [{ side: 'over', point: 80.5 }] },
    ])

    gradeSelections(db)
    expect(outcomes(db)).toEqual([2, 2, 2])
    db.close()
  })
})

describe('gradeSelections — idempotency', () => {
  it('does not regrade an event it has already settled', () => {
    const db = freshDb()
    seedEvent(db, { home: 110, away: 100, winner: 'home' }, [
      { type: 'h2h', line: null, sides: [{ side: 'home', point: null }, { side: 'away', point: null }] },
    ])

    expect(gradeSelections(db).selections).toBe(2)
    expect(gradeSelections(db).selections).toBe(0)
    expect(outcomes(db)).toEqual([1, 0])
    db.close()
  })
})
