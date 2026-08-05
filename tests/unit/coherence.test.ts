import { describe, expect, it } from 'bun:test'
import { findIncoherence, fixtureKeyOf, strikeOf } from '../../app/Services/quant/coherence'

/**
 * Ladder coherence.
 *
 * Unlike every other signal here this one reports a certainty, so the
 * tests lean hard on the cases where it must stay silent. A false
 * positive would be presented as arithmetic rather than as an opinion,
 * which makes it far more persuasive than it deserves to be, and the two
 * ways to produce one are comparing rungs that are not on the same ladder
 * and reading an untraded quote as a real price.
 *
 * Tickers are in Kalshi's real format, taken from the live catalogue.
 */

describe('fixtureKeyOf', () => {
  it('is shared across the market types of one fixture', () => {
    // The only identifier Kalshi exposes that spans a fixture's markets.
    expect(fixtureKeyOf('KXMLBTOTAL-26AUG042140SDAZ-16')).toBe('26AUG042140SDAZ')
    expect(fixtureKeyOf('KXMLBSPREAD-26AUG042140SDAZ-SD9')).toBe('26AUG042140SDAZ')
  })

  it('is empty-safe', () => {
    expect(fixtureKeyOf('')).toBe('')
    expect(fixtureKeyOf(null)).toBe('')
    expect(fixtureKeyOf('NOHYPHENS')).toBe('')
  })
})

describe('strikeOf', () => {
  it('reads a bare total', () => {
    expect(strikeOf('KXMLBTOTAL-26AUG042140SDAZ-16')).toBe(16)
  })

  it('reads a spread that prefixes the team', () => {
    expect(strikeOf('KXMLBSPREAD-26AUG042140DETSEA-DET7')).toBe(7)
  })

  it('declines a three-way winner market', () => {
    // These are alternatives, not an ordered ladder. Reading them as
    // rungs would report every fixture on the board as incoherent.
    expect(strikeOf('KXEFLCUPGAME-26AUG08WATCRA-WAT')).toBeNull()
    expect(strikeOf('KXEFLCUPGAME-26AUG08WATCRA-TIE')).toBeNull()
  })

  it('is empty-safe', () => {
    expect(strikeOf('')).toBeNull()
    expect(strikeOf(null)).toBeNull()
  })
})

describe('findIncoherence', () => {
  it('says nothing about a ladder in the right order', () => {
    // Harder to clear, so strictly less likely. This is the normal case.
    const found = findIncoherence([
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-14', price: 0.70 },
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-15', price: 0.55 },
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-16', price: 0.40 },
    ])

    expect(found).toEqual([])
  })

  it('catches a harder rung priced above an easier one', () => {
    const found = findIncoherence([
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-14', price: 0.50 },
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-15', price: 0.62 },
    ])

    expect(found).toHaveLength(1)
    expect(found[0]!.ticker).toBe('KXMLBTOTAL-26AUG042140SDAZ-15')
    expect(found[0]!.versusTicker).toBe('KXMLBTOTAL-26AUG042140SDAZ-14')
    expect(found[0]!.gap).toBeCloseTo(0.12, 6)
  })

  it('does not compare two different fixtures', () => {
    const found = findIncoherence([
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-16', price: 0.80 },
      { ticker: 'KXMLBTOTAL-26AUG042040TBCOL-14', price: 0.30 },
    ])

    expect(found).toEqual([])
  })

  it('does not compare a total against a spread', () => {
    // Same fixture, different question. Sixteen runs and a nine-run
    // margin are not rungs of one ladder.
    const found = findIncoherence([
      { ticker: 'KXMLBSPREAD-26AUG042140SDAZ-SD9', price: 0.80 },
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-14', price: 0.30 },
    ])

    expect(found).toEqual([])
  })

  it('does not compare the two teams of one spread', () => {
    // Both ladders ascend on their own side. Comparing across them would
    // report a violation on every fixture that lists both.
    const found = findIncoherence([
      { ticker: 'KXMLBSPREAD-26AUG042140DETSEA-DET6', price: 0.20 },
      { ticker: 'KXMLBSPREAD-26AUG042140DETSEA-SEA6', price: 0.75 },
    ])

    expect(found).toEqual([])
  })

  it('ignores untraded rungs rather than reading them as impossible', () => {
    // A zero is a market nobody has quoted, not a claim it cannot happen.
    const found = findIncoherence([
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-14', price: 0 },
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-15', price: 0.55 },
    ])

    expect(found).toEqual([])
  })

  it('ignores a three-way winner market entirely', () => {
    const found = findIncoherence([
      { ticker: 'KXEFLCUPGAME-26AUG08WATCRA-WAT', price: 0.55 },
      { ticker: 'KXEFLCUPGAME-26AUG08WATCRA-CRA', price: 0.25 },
      { ticker: 'KXEFLCUPGAME-26AUG08WATCRA-TIE', price: 0.20 },
    ])

    expect(found).toEqual([])
  })

  it('reports each inversion once, against its neighbour', () => {
    // One stale rung should not be reported against every rung beneath it.
    const found = findIncoherence([
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-14', price: 0.30 },
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-15', price: 0.25 },
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-16', price: 0.90 },
    ])

    expect(found).toHaveLength(1)
    expect(found[0]!.strike).toBe(16)
    expect(found[0]!.versusStrike).toBe(15)
  })

  it('ignores an inversion too small to trade through', () => {
    // A one-cent inversion is inside the spread and the fees.
    const found = findIncoherence([
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-14', price: 0.50 },
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-15', price: 0.502 },
    ], 0.01)

    expect(found).toEqual([])
  })

  it('ranks the worst inversion first', () => {
    const found = findIncoherence([
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-14', price: 0.50 },
      { ticker: 'KXMLBTOTAL-26AUG042140SDAZ-15', price: 0.55 },
      { ticker: 'KXMLBTOTAL-26AUG042040TBCOL-17', price: 0.30 },
      { ticker: 'KXMLBTOTAL-26AUG042040TBCOL-18', price: 0.70 },
    ])

    expect(found[0]!.gap).toBeCloseTo(0.40, 6)
    expect(found[1]!.gap).toBeCloseTo(0.05, 6)
  })

  it('needs at least two rungs to say anything', () => {
    expect(findIncoherence([{ ticker: 'KXMLBTOTAL-26AUG042140SDAZ-16', price: 0.9 }])).toEqual([])
    expect(findIncoherence([])).toEqual([])
  })
})
