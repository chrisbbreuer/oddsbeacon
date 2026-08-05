import type { Database } from 'bun:sqlite'

/**
 * Which signals actually beat the close.
 *
 * Seven signals move fair value and every weight behind them is an
 * assertion. `decision_evidence` has always recorded what each one
 * contributed to each decision, and nothing has ever gone back to check
 * whether the ones that spoke loudest were the ones that were right.
 *
 * Closing line value is the measure, not profit. A settled win rate takes
 * hundreds of positions to say anything, while CLV converges in dozens
 * and is the standard proof that an estimate carried real information: if
 * a signal pushed toward a side and that side shortened before the event
 * started, the signal knew something the market had not priced yet.
 *
 * Attribution is per signal per decision, and deliberately crude about
 * credit. A decision carries several signals and this gives each the same
 * directional credit rather than apportioning by contribution size,
 * because apportioning would bake in the very weights this exists to
 * test.
 */

export interface SignalScore {
  kind: string
  /** Decisions this signal contributed to and that have since closed. */
  samples: number
  /** Share where the signal pointed the way the market later moved. */
  hitRate: number
  /** Mean CLV in probability points, signed for the signal's direction. */
  avgClvPoints: number
  /** Mean absolute contribution, to see how loudly it speaks. */
  avgContribution: number
}

/**
 * Score every signal against how the market closed.
 *
 * A decision is scoreable once its market has a closing price: `result`
 * is set, or the market is no longer open and carries a last price. The
 * comparison is between the price we saw and the price at the close, from
 * the perspective of the side the decision took.
 */
export function scoreSignals(db: Database): SignalScore[] {
  const rows = db.query(`
    SELECT
      e.kind AS kind,
      e.contribution AS contribution,
      d.market_price AS entryPrice,
      d.side AS side,
      m.last_price AS closePrice
    FROM decision_evidence e
    JOIN trade_decisions d ON d.id = e.trade_decision_id
    JOIN prediction_markets m ON m.id = d.prediction_market_id
    WHERE m.status != 'open'
      AND m.last_price > 0
      AND d.market_price > 0
  `).all() as Array<{
    kind: string
    contribution: number
    entryPrice: number
    side: string
    closePrice: number
  }>

  const byKind = new Map<string, { samples: number, hits: number, clv: number, contribution: number }>()

  for (const row of rows) {
    // A contribution of zero is the signal declining to speak. Counting
    // it would dilute every rate with cases the signal had no view on.
    if (!row.contribution)
      continue

    // Both prices from the decision's own side, so a move is comparable.
    const close = row.side === 'yes' ? row.closePrice : 1 - row.closePrice
    const clv = close - row.entryPrice

    // Did this signal point the way the market went? Its contribution is
    // signed toward the side taken, so agreement is a matching sign.
    const pointedRight = (row.contribution > 0 && clv > 0) || (row.contribution < 0 && clv < 0)

    const bucket = byKind.get(row.kind) ?? { samples: 0, hits: 0, clv: 0, contribution: 0 }
    bucket.samples++
    bucket.hits += pointedRight ? 1 : 0
    // Signed for the signal's direction, so a signal that argued against
    // a side that then drifted out scores positively.
    bucket.clv += row.contribution > 0 ? clv : -clv
    bucket.contribution += Math.abs(row.contribution)
    byKind.set(row.kind, bucket)
  }

  return [...byKind.entries()]
    .map(([kind, b]) => ({
      kind,
      samples: b.samples,
      hitRate: b.samples > 0 ? b.hits / b.samples : 0,
      avgClvPoints: b.samples > 0 ? (b.clv / b.samples) * 100 : 0,
      avgContribution: b.samples > 0 ? b.contribution / b.samples : 0,
    }))
    // Most-evidenced first: a signal with four samples and a perfect
    // record is noise, and sorting by hit rate would put it on top.
    .sort((a, b) => b.samples - a.samples)
}

/**
 * Is there enough history for any of this to mean anything?
 *
 * Below roughly thirty scored decisions a hit rate is closer to a coin
 * flip than to a measurement, and presenting one as a finding is how a
 * model talks itself into trusting a signal that has done nothing.
 */
export const MIN_MEANINGFUL_SAMPLES = 30

export function isMeaningful(score: SignalScore): boolean {
  return score.samples >= MIN_MEANINGFUL_SAMPLES
}
