import { rmSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'bun:test'
import { isMeaningful, MIN_MEANINGFUL_SAMPLES, scoreSignals } from '../../app/Services/quant/attribution'
import { schemaFor } from '../support/schema'

/**
 * Per-signal scoring against the close.
 *
 * The point of this is to be able to kill a signal, so the tests that
 * matter most are the ones proving it can report a signal as wrong. A
 * scorer that only ever flatters is worse than none: it would launder
 * every guessed weight in the model into a number that looks measured.
 */

const TABLES = ['prediction_markets', 'trade_decisions', 'decision_evidence', 'trading_strategies']
const paths: string[] = []

function freshDb() {
  const path = `tests/temp/attribution-${paths.length}-${Bun.nanoseconds()}.sqlite`
  paths.push(path)
  return schemaFor(path, TABLES)
}

afterEach(() => {
  for (const path of paths.splice(0)) {
    for (const suffix of ['', '-shm', '-wal'])
      rmSync(`${path}${suffix}`, { force: true })
  }
})

let seq = 0

/**
 * One closed market, one decision on it, and one signal that argued for
 * the side taken. `closePrice` is where the market ended up.
 */
function record(
  db: ReturnType<typeof freshDb>,
  options: { kind: string, contribution: number, entryPrice: number, closePrice: number, side?: string, status?: string },
) {
  seq++
  const side = options.side ?? 'yes'
  db.run(
    `INSERT INTO prediction_markets (id, venue, external_id, question, category, status, result, volume, liquidity, last_price, ends_at, created_at, updated_at)
     VALUES (?, 'kalshi', ?, 'q', 'Sports', ?, 'yes', 1000, 100, ?, '', '', '')`,
    [seq, `t${seq}`, options.status ?? 'settled', options.closePrice],
  )
  db.run(
    `INSERT INTO trade_decisions (id, trading_strategy_id, prediction_market_id, venue, side, market_price, fair_value, edge, confidence, limit_price, size, notional, rationale, decided_by, status, status_reason, created_at, updated_at)
     VALUES (?, 1, ?, 'kalshi', ?, ?, 0.5, 0.05, 0.7, 0, 0, 0, '', 'engine', 'placed', '', '', '')`,
    [seq, seq, side, options.entryPrice],
  )
  db.run(
    `INSERT INTO decision_evidence (trade_decision_id, kind, summary, value, contribution, sample_size, window_hours, created_at, updated_at)
     VALUES (?, ?, '', 0, ?, 10, 24, '', '')`,
    [seq, options.kind, options.contribution],
  )
}

describe('scoreSignals', () => {
  it('credits a signal that pointed the way the market then moved', () => {
    const db = freshDb()
    // Argued for yes at 40c; it closed at 55c.
    record(db, { kind: 'flow_imbalance', contribution: 0.03, entryPrice: 0.40, closePrice: 0.55 })

    const [score] = scoreSignals(db)

    expect(score!.kind).toBe('flow_imbalance')
    expect(score!.hitRate).toBe(1)
    expect(score!.avgClvPoints).toBeCloseTo(15, 5)
  })

  it('marks a signal wrong when the market moved against it', () => {
    const db = freshDb()
    // Argued for yes at 60c; it closed at 45c.
    record(db, { kind: 'smart_money', contribution: 0.03, entryPrice: 0.60, closePrice: 0.45 })

    const [score] = scoreSignals(db)

    expect(score!.hitRate).toBe(0)
    expect(score!.avgClvPoints).toBeCloseTo(-15, 5)
  })

  it('credits a signal that argued against a side that then drifted out', () => {
    const db = freshDb()
    // Argued against yes at 60c; it closed at 45c. The signal was right.
    record(db, { kind: 'reverse_line_move', contribution: -0.03, entryPrice: 0.60, closePrice: 0.45 })

    const [score] = scoreSignals(db)

    expect(score!.hitRate).toBe(1)
    expect(score!.avgClvPoints).toBeCloseTo(15, 5)
  })

  it('reads a no-side decision from that side', () => {
    const db = freshDb()
    // Took no at 40c (yes quoted 60c); yes closed at 45c, so no closed at
    // 55c and the position gained.
    record(db, { kind: 'flow_imbalance', contribution: 0.03, entryPrice: 0.40, closePrice: 0.45, side: 'no' })

    const [score] = scoreSignals(db)

    expect(score!.avgClvPoints).toBeCloseTo(15, 5)
  })

  it('ignores a signal that declined to speak', () => {
    const db = freshDb()
    record(db, { kind: 'squad_mismatch', contribution: 0, entryPrice: 0.40, closePrice: 0.55 })

    // A zero contribution is the signal having no view. Counting it would
    // dilute every rate with cases it never argued.
    expect(scoreSignals(db)).toEqual([])
  })

  it('ignores markets that have not closed', () => {
    const db = freshDb()
    record(db, { kind: 'flow_imbalance', contribution: 0.03, entryPrice: 0.40, closePrice: 0.55, status: 'open' })

    expect(scoreSignals(db)).toEqual([])
  })

  it('separates the signals rather than pooling them', () => {
    const db = freshDb()
    record(db, { kind: 'good', contribution: 0.03, entryPrice: 0.40, closePrice: 0.55 })
    record(db, { kind: 'good', contribution: 0.03, entryPrice: 0.40, closePrice: 0.50 })
    record(db, { kind: 'bad', contribution: 0.03, entryPrice: 0.60, closePrice: 0.40 })

    const byKind = Object.fromEntries(scoreSignals(db).map(s => [s.kind, s]))

    expect(byKind.good!.hitRate).toBe(1)
    expect(byKind.bad!.hitRate).toBe(0)
    expect(byKind.good!.samples).toBe(2)
  })

  it('ranks by evidence, not by hit rate', () => {
    const db = freshDb()
    // A perfect record over one decision must not outrank a longer one.
    record(db, { kind: 'lucky', contribution: 0.03, entryPrice: 0.40, closePrice: 0.55 })
    for (let i = 0; i < 3; i++)
      record(db, { kind: 'tested', contribution: 0.03, entryPrice: 0.40, closePrice: i === 0 ? 0.35 : 0.50 })

    expect(scoreSignals(db)[0]!.kind).toBe('tested')
  })
})

describe('isMeaningful', () => {
  it('refuses to call a short record a finding', () => {
    const thin = { kind: 'x', samples: MIN_MEANINGFUL_SAMPLES - 1, hitRate: 1, avgClvPoints: 20, avgContribution: 0.05 }

    // A perfect record over a handful of decisions is a coin flip that
    // landed the same way twice.
    expect(isMeaningful(thin)).toBe(false)
  })

  it('accepts one with enough behind it', () => {
    expect(isMeaningful({ kind: 'x', samples: MIN_MEANINGFUL_SAMPLES, hitRate: 0.5, avgClvPoints: 0, avgContribution: 0.05 })).toBe(true)
  })
})
