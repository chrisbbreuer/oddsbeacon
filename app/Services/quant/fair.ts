import type { Database } from 'bun:sqlite'
import { devig, expectedValuePct, kellyFraction } from '../../Support/devig'
import { nowIso } from '../../Support/keys'

/**
 * Consensus fair pricing.
 *
 * Turns raw quotes into the honest numbers the product reports: what each
 * outcome's true probability is, what the best available price is, and
 * whether the gap between them is real edge or just the book's margin
 * showing through.
 *
 * ### Order of operations, and why it matters
 * De-vigging happens **per book, then blends** — never the other way
 * round. Each book sets its own margin, so averaging raw prices across
 * books first produces a blended number that still contains a blended
 * margin, and removing "the" margin from that afterwards is removing a
 * quantity that belongs to no one. Doing it in this order means every
 * input to the blend is already a genuine probability estimate.
 *
 * The blend is weighted rather than flat. A flat average across books is a
 * *worse* estimator than the sharp price alone: recreational books shade
 * toward public money and copy the market late, so including them at equal
 * weight actively drags the estimate toward the crowd. `consensusWeight`
 * on each bookmaker encodes that, and the weights live in data so a book's
 * standing can change without a deploy.
 */

/** Below this many books a "consensus" is not one; the row is still written, flagged. */
const MIN_BOOKS_FOR_CONSENSUS = 2

/** Fraction of full Kelly to report. See `kellyFraction` for the reasoning. */
const KELLY_FRACTION = 0.25

interface QuoteRow {
  selection_id: number
  bookmaker_id: number
  price: number
  market_id: number
  side: string
  sharp: number
  consensus_weight: number
}

export interface FairPriceResult {
  markets: number
  selections: number
  written: number
  /** Selections whose best available price beats consensus fair value. */
  positiveEdge: number
}

/**
 * Recompute fair prices for every market that currently has quotes.
 *
 * Runs after each odds ingest. The whole pass is one transaction: a
 * half-written fair-price table would show edge on some selections and
 * stale numbers on others, which reads as a signal rather than as an
 * incomplete pass.
 */
export function computeFairPrices(db: Database, options: { marketIds?: number[] } = {}): FairPriceResult {
  const filter = options.marketIds?.length
    ? `AND m.id IN (${options.marketIds.map(() => '?').join(',')})`
    : ''
  const params = options.marketIds?.length ? options.marketIds : []

  const rows = db.query(`
    SELECT o.selection_id, o.bookmaker_id, o.price,
           s.market_id, s.side,
           b.sharp, b.consensus_weight
    FROM odds o
    JOIN selections s ON s.id = o.selection_id
    JOIN markets m ON m.id = s.market_id
    JOIN bookmakers b ON b.id = o.bookmaker_id
    WHERE o.available = 1 AND o.price > 1 AND m.complete = 1 ${filter}
    ORDER BY s.market_id ASC, s.position ASC, s.id ASC
  `).all(...params) as QuoteRow[]

  // Group into market → book → the quotes that book offers on it. A book's
  // prices must be de-vigged together, as a set, because the margin is a
  // property of the market as that book prices it — not of one side.
  const byMarket = new Map<number, Map<number, QuoteRow[]>>()
  for (const row of rows) {
    let books = byMarket.get(row.market_id)
    if (!books) {
      books = new Map()
      byMarket.set(row.market_id, books)
    }
    const quotes = books.get(row.bookmaker_id) ?? []
    quotes.push(row)
    books.set(row.bookmaker_id, quotes)
  }

  const upsert = db.prepare(`
    INSERT INTO fair_prices
      (selection_id, prob_consensus, prob_sharp, prob_multiplicative, prob_power, prob_shin,
       method_spread, fair_price, best_price, best_bookmaker_id, edge_pct, kelly_fraction,
       overround_pct, book_count, sharp_book_count, computed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (selection_id) DO UPDATE SET
      prob_consensus = excluded.prob_consensus,
      prob_sharp = excluded.prob_sharp,
      prob_multiplicative = excluded.prob_multiplicative,
      prob_power = excluded.prob_power,
      prob_shin = excluded.prob_shin,
      method_spread = excluded.method_spread,
      fair_price = excluded.fair_price,
      best_price = excluded.best_price,
      best_bookmaker_id = excluded.best_bookmaker_id,
      edge_pct = excluded.edge_pct,
      kelly_fraction = excluded.kelly_fraction,
      overround_pct = excluded.overround_pct,
      book_count = excluded.book_count,
      sharp_book_count = excluded.sharp_book_count,
      computed_at = excluded.computed_at,
      updated_at = excluded.updated_at
  `)

  const now = nowIso()
  let selectionsWritten = 0
  let positiveEdge = 0

  db.run('BEGIN')
  try {
    for (const [, books] of byMarket) {
      // Accumulators keyed by selection, across every book on this market.
      const weighted = new Map<number, { consensus: number, sharp: number, mult: number, power: number, shin: number }>()
      const weights = { total: 0, sharp: 0 }
      const best = new Map<number, { price: number, bookmakerId: number }>()
      const spread = new Map<number, number>()
      let overroundSum = 0
      let bookCount = 0
      let sharpBookCount = 0

      for (const [bookmakerId, quotes] of books) {
        // A single quote is not a market — there is no complementary side
        // to remove margin against, and "de-vigging" it would just return
        // the raw implied probability wearing a fair-value label.
        if (quotes.length < 2)
          continue

        const result = devig(quotes.map(q => q.price))
        const weight = Math.max(0, quotes[0]!.consensus_weight ?? 1)
        const isSharp = quotes[0]!.sharp === 1

        bookCount++
        if (isSharp)
          sharpBookCount++
        overroundSum += result.overround
        weights.total += weight
        if (isSharp)
          weights.sharp += weight

        for (const [index, quote] of quotes.entries()) {
          const acc = weighted.get(quote.selection_id) ?? { consensus: 0, sharp: 0, mult: 0, power: 0, shin: 0 }
          // Shin is the reported default; the others are carried so the
          // disagreement between methods stays visible downstream.
          acc.consensus += (result.shin[index] ?? 0) * weight
          acc.mult += (result.multiplicative[index] ?? 0) * weight
          acc.power += (result.power[index] ?? 0) * weight
          acc.shin += (result.shin[index] ?? 0) * weight
          if (isSharp)
            acc.sharp += (result.shin[index] ?? 0) * weight
          weighted.set(quote.selection_id, acc)

          spread.set(quote.selection_id, Math.max(spread.get(quote.selection_id) ?? 0, result.methodSpread))

          const current = best.get(quote.selection_id)
          if (!current || quote.price > current.price)
            best.set(quote.selection_id, { price: quote.price, bookmakerId })
        }
      }

      if (bookCount === 0)
        continue

      // Normalizing the blend keeps it a distribution. Weighted sums of
      // several distributions are only a distribution again once divided
      // by the total weight, and skipping this would inflate every
      // probability by the weight total — turning every market into edge.
      const avgOverround = overroundSum / bookCount

      let marketFairSum = 0
      for (const [, acc] of weighted)
        marketFairSum += acc.consensus / (weights.total || 1)

      for (const [selectionId, acc] of weighted) {
        const consensus = clampProb((acc.consensus / (weights.total || 1)) / (marketFairSum || 1))
        const sharpProb = weights.sharp > 0 ? clampProb(acc.sharp / weights.sharp) : 0
        const bestQuote = best.get(selectionId)
        const bestPrice = bestQuote?.price ?? 0

        const edge = bestPrice > 1 ? expectedValuePct(bestPrice, consensus) : 0
        if (edge > 0)
          positiveEdge++

        upsert.run(
          selectionId,
          consensus,
          sharpProb,
          clampProb(acc.mult / (weights.total || 1)),
          clampProb(acc.power / (weights.total || 1)),
          clampProb(acc.shin / (weights.total || 1)),
          spread.get(selectionId) ?? 0,
          consensus > 0 ? 1 / consensus : 0,
          bestPrice,
          bestQuote?.bookmakerId ?? null,
          edge,
          kellyFraction(bestPrice, consensus, KELLY_FRACTION),
          (avgOverround - 1) * 100,
          bookCount,
          sharpBookCount,
          now,
          now,
          now,
        )
        selectionsWritten++
      }
    }

    db.run('COMMIT')
  }
  catch (err) {
    try {
      db.run('ROLLBACK')
    }
    catch {
      // Connection gone; the original error is the one worth surfacing.
    }
    throw err
  }

  return {
    markets: byMarket.size,
    selections: selectionsWritten,
    written: selectionsWritten,
    positiveEdge,
  }
}

/** Keep probabilities inside (0,1) so downstream division never explodes. */
function clampProb(p: number): number {
  if (!Number.isFinite(p))
    return 0
  return Math.min(0.999999, Math.max(0, p))
}

export { MIN_BOOKS_FOR_CONSENSUS }
