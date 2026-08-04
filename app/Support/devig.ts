/**
 * Removing the bookmaker's margin from a set of prices.
 *
 * A price is not a probability. On a two-way market quoted 1.91 / 1.91 the
 * implied probabilities are 0.5236 each and sum to 1.047 — the extra 4.7%
 * is the book's cut, not information about the game. Comparing a price to
 * a raw implied probability therefore measures vig, and will report "edge"
 * on markets that have none. Every honest number downstream depends on
 * removing it first.
 *
 * The hard part is that removing it requires assuming *where it sits*, and
 * the standard methods disagree — most sharply on longshots, which is
 * exactly where value is most often claimed. So this module implements
 * three and reports all of them rather than quietly picking one:
 *
 * - **Multiplicative** — scale so the probabilities sum to 1. Assumes the
 *   margin is proportional to probability. Simple, standard, and known to
 *   overstate longshots, because books load more margin onto them than a
 *   proportional split implies.
 * - **Power** — find the exponent k where the transformed probabilities
 *   sum to 1. Applies more margin to longshots than to favourites, which
 *   matches observed book behaviour better, at the cost of a solve.
 * - **Shin** — model the margin as protection against insider money,
 *   solving for the insider share z. Usually the best calibrated of the
 *   three on liquid markets, and the one this codebase reports by default.
 *
 * All three are pure functions over an array of decimal prices, which is
 * what makes them directly testable — and they are tested, because a
 * silent sign error here would corrupt every downstream claim while still
 * producing entirely plausible-looking numbers.
 */

/** Iteration bounds for the solvers. Convergence is fast; these are rails. */
const MAX_ITERATIONS = 100
const TOLERANCE = 1e-10

export interface DevigResult {
  multiplicative: number[]
  power: number[]
  shin: number[]
  /** Sum of raw implied probabilities. 1.047 means a 4.7% margin. */
  overround: number
  /** Largest gap between any two methods on any single outcome. */
  methodSpread: number
}

/** Implied probabilities from decimal prices, margin included. */
export function impliedProbabilities(prices: number[]): number[] {
  return prices.map(p => (Number.isFinite(p) && p > 1 ? 1 / p : 0))
}

/**
 * Proportional scaling: each probability divided by their sum.
 *
 * Assumes the margin is spread in proportion to each outcome's chance.
 */
export function devigMultiplicative(probs: number[]): number[] {
  const total = probs.reduce((sum, p) => sum + p, 0)
  if (total <= 0)
    return probs.map(() => 0)
  return probs.map(p => p / total)
}

/**
 * Power method: find the exponent k for which the transformed
 * probabilities sum to 1.
 *
 * The raw probabilities sum above 1 for any real market, and raising a
 * value below 1 to a higher power shrinks it, so the solution always has
 * k > 1 and the sum falls monotonically as k rises — which is what makes a
 * plain bisection both safe and quick here.
 */
export function devigPower(probs: number[]): number[] {
  const total = probs.reduce((sum, p) => sum + p, 0)
  if (total <= 0)
    return probs.map(() => 0)

  // Already fair, or inverted — which a true exchange or a live arbitrage
  // genuinely can be. There is no margin to remove, so just normalize.
  if (total <= 1)
    return devigMultiplicative(probs)

  let low = 1
  let high = 10
  let k = 1

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    k = (low + high) / 2
    const sum = probs.reduce((acc, p) => acc + (p > 0 ? p ** k : 0), 0)
    if (Math.abs(sum - 1) < TOLERANCE)
      break
    if (sum > 1)
      low = k
    else
      high = k
  }

  // The solver lands within tolerance rather than exactly on it, so
  // normalize — the caller is owed a real distribution, not one summing
  // to 0.9999 that quietly biases everything computed from it.
  return devigMultiplicative(probs.map(p => (p > 0 ? p ** k : 0)))
}

/**
 * Shin's method: treat the margin as the book's protection against traders
 * holding better information, and solve for that insider share z.
 *
 * z is found by bisection against the constraint that the resulting
 * probabilities sum to 1. It is bounded well below 1 because z → 1 means
 * the market is entirely insiders, at which point the formula degenerates.
 */
export function devigShin(probs: number[]): number[] {
  const total = probs.reduce((sum, p) => sum + p, 0)
  if (total <= 0)
    return probs.map(() => 0)
  if (total <= 1)
    return devigMultiplicative(probs)

  const apply = (z: number): number[] => {
    const denominator = 2 * (1 - z)
    if (denominator <= 0)
      return probs.map(() => 0)
    return probs.map((q) => {
      if (q <= 0)
        return 0
      const inner = z * z + 4 * (1 - z) * (q * q) / total
      return (Math.sqrt(Math.max(0, inner)) - z) / denominator
    })
  }

  let low = 0
  let high = 0.9
  let z = 0

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    z = (low + high) / 2
    const sum = apply(z).reduce((acc, p) => acc + p, 0)
    if (Math.abs(sum - 1) < TOLERANCE)
      break
    // More assumed insider money removes more margin, so the sum falls as
    // z rises.
    if (sum > 1)
      low = z
    else
      high = z
  }

  return devigMultiplicative(apply(z))
}

/**
 * Run all three methods over one market's prices.
 *
 * `methodSpread` is the largest disagreement between them on any single
 * outcome. It is a signal rather than diagnostics: when the three models
 * diverge the market is thin or oddly shaped and its fair value deserves
 * less trust, so the number is stored and surfaced rather than thrown away
 * once a default has been picked.
 */
export function devig(prices: number[]): DevigResult {
  const probs = impliedProbabilities(prices)
  const overround = probs.reduce((sum, p) => sum + p, 0)

  const multiplicative = devigMultiplicative(probs)
  const power = devigPower(probs)
  const shin = devigShin(probs)

  let methodSpread = 0
  for (let i = 0; i < probs.length; i++) {
    const values = [multiplicative[i] ?? 0, power[i] ?? 0, shin[i] ?? 0]
    methodSpread = Math.max(methodSpread, Math.max(...values) - Math.min(...values))
  }

  return { multiplicative, power, shin, overround, methodSpread }
}

/**
 * Expected return per unit staked, as a percent. Positive means the price
 * pays more than the probability justifies.
 */
export function expectedValuePct(price: number, trueProb: number): number {
  if (!Number.isFinite(price) || price <= 1 || trueProb <= 0)
    return 0
  return (price * trueProb - 1) * 100
}

/**
 * Fractional Kelly stake for a binary bet.
 *
 * Full Kelly is growth-optimal only when the probability is exactly right,
 * and ours never is — it is an estimate drawn from a market that already
 * disagrees with us. Full Kelly on a slightly overstated edge is a quick
 * route to ruin, because the penalty for overbetting rises far faster than
 * the cost of underbetting. The fraction is the standard hedge against
 * that estimation error, and it is applied here rather than left to
 * callers so that no path can stake full by omission.
 *
 * Returns 0 when there is no edge — never a negative stake.
 */
export function kellyFraction(price: number, trueProb: number, fraction = 0.25): number {
  if (!Number.isFinite(price) || price <= 1 || trueProb <= 0 || trueProb >= 1)
    return 0
  const b = price - 1
  const edge = b * trueProb - (1 - trueProb)
  if (edge <= 0)
    return 0
  return Math.min(1, (edge / b) * fraction)
}
