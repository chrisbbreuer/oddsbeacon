import { rmSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'bun:test'
import { computeCalibration } from '../../app/Services/quant/calibration'
import { settle } from '../../app/Services/quant/settle'
import { schemaFor } from '../support/schema'

/**
 * The leg between "a game finished" and "the model has a score".
 *
 * `gradeSelections` was covered; the three stages after it were not, and
 * they are the ones that decide whether this system can ever say it has
 * been right. On a fresh install the whole chain reports zero, and zero
 * from "nothing has settled yet" is indistinguishable from zero from
 * "the last stage silently drops everything" unless something drives a
 * settled event all the way through.
 *
 * So these seed one finished event with a prediction attached and assert
 * a calibration bucket comes out the other end.
 */

const TABLES = [
  'sports', 'sports_teams', 'market_events', 'markets', 'selections',
  'event_results', 'bookmakers', 'odds', 'odds_snapshots', 'closing_lines',
  'fair_prices', 'feature_snapshots', 'calibration_buckets',
]

const paths: string[] = []

function freshDb() {
  const path = `tests/temp/calibration-${paths.length}-${Bun.nanoseconds()}.sqlite`
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
 * A moneyline game about to start, with the model's opinion attached.
 *
 * Seeded as `scheduled` at roughly now, because that is the only state in
 * which a closing line can be captured: `captureClosingLines` looks for
 * events near their start that have not been captured yet. Seeding one
 * already `final` skips that window entirely and produces a settled event
 * with no close to measure against, which is what a first attempt at this
 * fixture did.
 *
 * `fairProbHome` is what the model gave the home side, `bestPrice` the
 * price it saw, and `closePrice` where the market ends up.
 */
function seedUpcomingEvent(
  db: ReturnType<typeof freshDb>,
  options: { fairProbHome: number, bestPrice?: number, closePrice?: number, eventId?: number },
) {
  const id = options.eventId ?? 1
  const homeSelection = id * 10
  const awaySelection = id * 10 + 1
  const bestPrice = options.bestPrice ?? 2.0
  const closePrice = options.closePrice ?? 1.9
  const commenceAt = new Date(Date.now() + 60_000).toISOString()
  const capturedAt = new Date().toISOString()

  if (id === 1) {
    db.run(`INSERT INTO sports (id, slug, title, grouping, active, position) VALUES (1, 'nba', 'NBA', 'Basketball', 1, 1)`)
    db.run(`INSERT INTO bookmakers (id, slug, short, name, active, sharp, consensus_weight) VALUES (1, 'pin', 'PIN', 'Pinnacle', 1, 1, 1.0)`)
  }

  db.run(
    `INSERT INTO market_events (id, sport_id, title, commence_at, status, closing_captured_at)
     VALUES (?, 1, 'A at B', ?, 'scheduled', '')`,
    [id, commenceAt],
  )
  db.run(
    `INSERT INTO markets (id, market_event_id, market_type, line, line_key, period, complete, status, position)
     VALUES (?, ?, 'h2h', NULL, '', 'full_game', 1, 'open', 0)`,
    [id, id],
  )
  for (const [selectionId, side] of [[homeSelection, 'home'], [awaySelection, 'away']] as const) {
    db.run(
      `INSERT INTO selections (id, market_id, label, side, point, point_key, position, outcome, graded_at)
       VALUES (?, ?, ?, ?, NULL, '', ?, -1, '')`,
      [selectionId, id, side, side, selectionId],
    )
    // The live quote captureClosingLines freezes as the close.
    db.run(
      `INSERT INTO odds (selection_id, bookmaker_id, price, available, created_at, updated_at)
       VALUES (?, 1, ?, 1, ?, ?)`,
      [selectionId, side === 'home' ? closePrice : 2.1, capturedAt, capturedAt],
    )
  }

  // What the model thought, frozen before the game. `label = -1` is the
  // unlabelled marker labelSnapshots looks for.
  db.run(
    `INSERT INTO feature_snapshots
       (selection_id, sport_slug, market_type, side, fair_prob, best_price, label, clv_pct, closing_fair_prob, captured_at, labelled_at)
     VALUES (?, 'nba', 'h2h', 'home', ?, ?, -1, 0, 0, ?, '')`,
    [homeSelection, options.fairProbHome, bestPrice, capturedAt],
  )
}

/** The game finishes. This is the transition the whole loop waits on. */
function finish(db: ReturnType<typeof freshDb>, options: { homeWon: boolean, eventId?: number }) {
  const id = options.eventId ?? 1
  db.run(`UPDATE market_events SET status = 'final' WHERE id = ?`, [id])
  db.run(
    `INSERT INTO event_results (market_event_id, home_score, away_score, winner_side, completed, source, settled_at, graded_at)
     VALUES (?, ?, ?, ?, 1, 'test', ?, '')`,
    [id, options.homeWon ? 110 : 100, options.homeWon ? 100 : 110, options.homeWon ? 'home' : 'away', new Date().toISOString()],
  )
}

/**
 * The real cadence: the pipeline runs on a timer, so settle() sees the
 * event before it starts (capturing the close) and again after it ends
 * (grading and labelling). Collapsing that into one call would test an
 * ordering production never uses.
 */
function runThroughSettlement(
  db: ReturnType<typeof freshDb>,
  options: { homeWon: boolean, eventId?: number },
) {
  settle(db)
  finish(db, options)
  return settle(db)
}

describe('settle to calibration', () => {
  it('carries one settled event through to a scored bucket', () => {
    const db = freshDb()
    seedUpcomingEvent(db, { fairProbHome: 0.75 })

    settle(db)
    // The close has to be frozen while the game is still upcoming.
    expect(db.query('SELECT COUNT(*) c FROM closing_lines').get()).toMatchObject({ c: 2 })

    finish(db, { homeWon: true })
    const settlement = settle(db)

    expect(settlement.eventsGraded).toBe(1)
    // The critical link: a graded selection must label its snapshot, or
    // calibration has nothing to read no matter how many games finish.
    expect(settlement.snapshotsLabelled).toBe(1)

    const calibration = computeCalibration(db)

    expect(calibration.sampleSize).toBe(1)
    expect(calibration.buckets).toBeGreaterThan(0)
    expect(calibration.scopes).toBeGreaterThan(0)
  })

  it('scores a confident correct call better than a confident wrong one', () => {
    const right = freshDb()
    seedUpcomingEvent(right, { fairProbHome: 0.9 })
    runThroughSettlement(right, { homeWon: true })

    const wrong = freshDb()
    seedUpcomingEvent(wrong, { fairProbHome: 0.9 })
    runThroughSettlement(wrong, { homeWon: false })

    // Brier is a squared error, so lower is better. A model that says 90%
    // and is right must score below one that says 90% and is wrong;
    // if this inverts, every track record on the site is backwards.
    expect(computeCalibration(right).overallBrier)
      .toBeLessThan(computeCalibration(wrong).overallBrier)
  })

  it('records positive CLV when the price beat the close', () => {
    const db = freshDb()
    // Took 2.20, market closed 1.80: the line moved our way.
    seedUpcomingEvent(db, { fairProbHome: 0.6, bestPrice: 2.2, closePrice: 1.8 })

    runThroughSettlement(db, { homeWon: true })

    const snapshot = db.query('SELECT clv_pct FROM feature_snapshots').get() as { clv_pct: number }
    expect(snapshot.clv_pct).toBeGreaterThan(0)
  })

  it('records negative CLV when the market moved against the price taken', () => {
    const db = freshDb()
    // Took 1.80, market closed 2.20: worse than the close.
    seedUpcomingEvent(db, { fairProbHome: 0.6, bestPrice: 1.8, closePrice: 2.2 })

    runThroughSettlement(db, { homeWon: true })

    const snapshot = db.query('SELECT clv_pct FROM feature_snapshots').get() as { clv_pct: number }
    expect(snapshot.clv_pct).toBeLessThan(0)
  })

  it('leaves an event with no result alone', () => {
    const db = freshDb()
    seedUpcomingEvent(db, { fairProbHome: 0.75 })

    // The game has not finished, so nothing may be graded or scored.
    const settlement = settle(db)

    expect(settlement.eventsGraded).toBe(0)
    expect(settlement.snapshotsLabelled).toBe(0)
    expect(computeCalibration(db).sampleSize).toBe(0)
  })

  it('accumulates across events rather than replacing', () => {
    const db = freshDb()
    for (const [eventId, fairProbHome] of [[1, 0.7], [2, 0.3], [3, 0.8]] as const)
      seedUpcomingEvent(db, { fairProbHome, eventId })

    settle(db)
    for (const [eventId, homeWon] of [[1, true], [2, false], [3, true]] as const)
      finish(db, { homeWon, eventId })
    settle(db)

    expect(computeCalibration(db).sampleSize).toBe(3)
  })

  it('is idempotent, so a re-run does not double count', () => {
    const db = freshDb()
    seedUpcomingEvent(db, { fairProbHome: 0.75 })
    runThroughSettlement(db, { homeWon: true })

    computeCalibration(db)
    // The pipeline runs every five minutes over the same settled history.
    settle(db)
    const second = computeCalibration(db)

    expect(second.sampleSize).toBe(1)
  })
})
