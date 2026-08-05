/**
 * A venue disagreeing with itself.
 *
 * Kalshi lists a spread or a total as a ladder: over 14 runs, over 15,
 * over 16, each its own market. The prices are not merely related, they
 * are ordered by arithmetic. Scoring more than 16 requires scoring more
 * than 15, so P(over 16) can never exceed P(over 15), whatever anyone
 * thinks about the game.
 *
 * When the ladder is out of order the venue has mispriced itself, and
 * unusually for anything in this codebase that is a certainty rather than
 * an estimate. Every other signal here argues about what is likely. This
 * one reports an inconsistency that cannot be correct under any view of
 * the fixture, which is why it is allowed to speak louder than the rest.
 *
 * It is not a claim that the trade is free: crossing the spread and
 * paying fees can exceed a one-cent inversion, and a stale quote on an
 * untraded rung looks identical to a real one. Sizing and execution are
 * the caller's problem. This only reports the inconsistency.
 */

export interface LadderMarket {
  ticker: string
  /** Probability for the yes side, 0..1. */
  price: number
}

export interface Incoherence {
  /** The rung priced too high relative to an easier one. */
  ticker: string
  /** The easier rung it contradicts. */
  versusTicker: string
  strike: number
  versusStrike: number
  price: number
  versusPrice: number
  /** How far out of order, in probability. */
  gap: number
}

/**
 * The fixture a ticker belongs to.
 *
 * `KXMLBTOTAL-26AUG042140SDAZ-16` and `KXMLBSPREAD-26AUG042140SDAZ-SD9`
 * share `26AUG042140SDAZ`: date, time and both clubs. It is the only
 * identifier Kalshi exposes that is common across a fixture's markets.
 */
export function fixtureKeyOf(ticker: unknown): string {
  const parts = String(ticker ?? '').trim().toUpperCase().split('-')
  return parts.length >= 2 ? (parts[1] ?? '') : ''
}

/**
 * The rung's threshold.
 *
 * A total names it outright (`-16`), a spread prefixes the team (`-DET7`).
 * Returns null when the last segment carries no number, which is how a
 * three-way winner market (`-DET`, `-TIE`) declines to be read as a rung:
 * those are alternatives, not an ordered ladder, and comparing them this
 * way would report every fixture as incoherent.
 */
export function strikeOf(ticker: unknown): number | null {
  const parts = String(ticker ?? '').trim().toUpperCase().split('-')
  const last = parts.length >= 3 ? (parts[parts.length - 1] ?? '') : ''
  const digits = last.match(/(\d+(?:\.\d+)?)$/)

  if (!digits)
    return null

  const value = Number(digits[1])
  return Number.isFinite(value) ? value : null
}

/** The series a ticker belongs to, so ladders are not compared across types. */
function seriesOf(ticker: string): string {
  return String(ticker).trim().toUpperCase().split('-')[0] ?? ''
}

/**
 * The side a spread rung belongs to, so two teams' ladders on the same
 * fixture are not compared with each other.
 *
 * `-DET7` is Detroit's rung; `-16` on a total has no side. Two spread
 * ladders for opposite teams both ascend, and comparing across them would
 * report a violation on every fixture that has both.
 */
function sideOf(ticker: string): string {
  const parts = String(ticker).trim().toUpperCase().split('-')
  const last = parts[parts.length - 1] ?? ''
  return last.replace(/\d+(?:\.\d+)?$/, '')
}

/**
 * Find rungs priced above an easier rung on the same ladder.
 *
 * Only adjacent-in-order pairs are compared, so one badly stale quote
 * reports once rather than against every rung beneath it.
 */
export function findIncoherence(markets: LadderMarket[], minGap = 0.01): Incoherence[] {
  const ladders = new Map<string, Array<{ ticker: string, price: number, strike: number }>>()

  for (const market of markets) {
    const strike = strikeOf(market.ticker)
    if (strike === null)
      continue

    // A price of zero is an untraded rung, not a claim that it cannot
    // happen, and treating it as one would invent violations everywhere.
    if (!(market.price > 0) || !(market.price < 1))
      continue

    const key = `${seriesOf(market.ticker)}|${fixtureKeyOf(market.ticker)}|${sideOf(market.ticker)}`
    const rungs = ladders.get(key) ?? []
    rungs.push({ ticker: market.ticker, price: market.price, strike })
    ladders.set(key, rungs)
  }

  const found: Incoherence[] = []

  for (const rungs of ladders.values()) {
    if (rungs.length < 2)
      continue

    rungs.sort((a, b) => a.strike - b.strike)

    for (let i = 1; i < rungs.length; i++) {
      const harder = rungs[i]!
      const easier = rungs[i - 1]!
      const gap = harder.price - easier.price

      // Harder priced above easier. Under no view of the fixture can
      // clearing a higher bar be more likely than clearing a lower one.
      if (gap >= minGap) {
        found.push({
          ticker: harder.ticker,
          versusTicker: easier.ticker,
          strike: harder.strike,
          versusStrike: easier.strike,
          price: harder.price,
          versusPrice: easier.price,
          gap,
        })
      }
    }
  }

  return found.sort((a, b) => b.gap - a.gap)
}
