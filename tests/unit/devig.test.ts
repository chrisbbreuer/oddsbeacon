import { describe, expect, it } from 'bun:test'
import {
  devig,
  devigMultiplicative,
  devigPower,
  devigShin,
  expectedValuePct,
  impliedProbabilities,
  kellyFraction,
} from '../../app/Support/devig'

/**
 * The de-vig layer is the foundation every honest number in the product
 * rests on, and a sign error in it would still produce plausible output.
 * These tests pin the properties that must hold rather than specific
 * values, so a future reimplementation is checked on behaviour.
 */

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('impliedProbabilities', () => {
  it('inverts decimal odds', () => {
    expect(impliedProbabilities([2, 4])).toEqual([0.5, 0.25])
  })

  it('treats invalid prices as zero rather than infinity', () => {
    expect(impliedProbabilities([0, 1, Number.NaN, -3])).toEqual([0, 0, 0, 0])
  })
})

describe('de-vig methods', () => {
  // 1.91 / 1.91 is the canonical -110 two-way market: a 4.76% hold.
  const standard = [1.91, 1.91]
  // A market with a heavy favourite, where the methods diverge most.
  const lopsided = [1.05, 15.0]
  const threeWay = [2.4, 3.5, 3.1]

  it('every method returns a distribution summing to 1', () => {
    for (const prices of [standard, lopsided, threeWay]) {
      const probs = impliedProbabilities(prices)
      expect(sum(devigMultiplicative(probs))).toBeCloseTo(1, 9)
      expect(sum(devigPower(probs))).toBeCloseTo(1, 9)
      expect(sum(devigShin(probs))).toBeCloseTo(1, 9)
    }
  })

  it('removes the margin rather than preserving it', () => {
    const probs = impliedProbabilities(standard)
    // The raw prices imply 104.7%; that surplus is the book's cut.
    expect(sum(probs)).toBeGreaterThan(1.04)
    expect(sum(devigShin(probs))).toBeCloseTo(1, 9)
  })

  it('keeps a symmetric market symmetric', () => {
    const probs = impliedProbabilities(standard)
    for (const method of [devigMultiplicative, devigPower, devigShin]) {
      const [a, b] = method(probs)
      expect(a).toBeCloseTo(0.5, 9)
      expect(b).toBeCloseTo(0.5, 9)
    }
  })

  it('preserves the ordering of outcomes', () => {
    const probs = impliedProbabilities(threeWay)
    for (const method of [devigMultiplicative, devigPower, devigShin]) {
      const out = method(probs)
      // 2.40 is the shortest price, so it must stay the likeliest outcome.
      expect(out[0]).toBeGreaterThan(out[2]!)
      expect(out[2]).toBeGreaterThan(out[1]!)
    }
  })

  it('shades the longshot below the multiplicative estimate', () => {
    // The favourite-longshot bias is the entire reason power and Shin
    // exist: books load extra margin onto longshots, so a proportional
    // split leaves the longshot overstated.
    const probs = impliedProbabilities(lopsided)
    const mult = devigMultiplicative(probs)
    const shin = devigShin(probs)
    const power = devigPower(probs)

    expect(shin[1]).toBeLessThan(mult[1]!)
    expect(power[1]).toBeLessThan(mult[1]!)
  })

  it('leaves a margin-free market untouched', () => {
    // An exchange at true 50/50 pays 2.00 each side. There is nothing to
    // remove, and a method that "removes" anything here is broken.
    const probs = impliedProbabilities([2, 2])
    expect(devigShin(probs)[0]).toBeCloseTo(0.5, 9)
    expect(devigPower(probs)[0]).toBeCloseTo(0.5, 9)
  })

  it('handles an arbitrage, where probabilities sum below 1', () => {
    // Best prices across books can imply under 100%. The methods must
    // still return a valid distribution instead of dividing by zero.
    const probs = impliedProbabilities([2.2, 2.2])
    expect(sum(probs)).toBeLessThan(1)
    expect(sum(devigShin(probs))).toBeCloseTo(1, 9)
    expect(sum(devigPower(probs))).toBeCloseTo(1, 9)
  })
})

describe('devig', () => {
  it('reports the overround and the disagreement between methods', () => {
    const result = devig([1.91, 1.91])
    expect(result.overround).toBeCloseTo(1.0471, 3)
    // A symmetric market is the one case all three methods agree on.
    expect(result.methodSpread).toBeCloseTo(0, 6)
  })

  it('reports a real spread where the methods diverge', () => {
    const result = devig([1.05, 15.0])
    expect(result.methodSpread).toBeGreaterThan(0)
  })
})

describe('expectedValuePct', () => {
  it('is zero at a fair price', () => {
    expect(expectedValuePct(2, 0.5)).toBeCloseTo(0, 9)
  })

  it('is positive when the price beats the probability', () => {
    expect(expectedValuePct(2.2, 0.5)).toBeCloseTo(10, 9)
  })

  it('is negative when it does not', () => {
    expect(expectedValuePct(1.8, 0.5)).toBeCloseTo(-10, 9)
  })
})

describe('kellyFraction', () => {
  it('is zero without an edge', () => {
    expect(kellyFraction(2, 0.5)).toBe(0)
    expect(kellyFraction(1.8, 0.5)).toBe(0)
  })

  it('never returns a negative stake', () => {
    expect(kellyFraction(1.5, 0.2)).toBe(0)
  })

  it('scales by the configured fraction', () => {
    const full = kellyFraction(2, 0.6, 1)
    const quarter = kellyFraction(2, 0.6, 0.25)
    // Full Kelly at even money on a 60% shot stakes 20% of bankroll.
    expect(full).toBeCloseTo(0.2, 9)
    expect(quarter).toBeCloseTo(0.05, 9)
  })

  it('stakes more as the edge grows', () => {
    expect(kellyFraction(2, 0.7)).toBeGreaterThan(kellyFraction(2, 0.6))
  })
})
