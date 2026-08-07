import { describe, expect, it } from 'bun:test'
import fixture from '../fixtures/pinnacle-mlb.json'
import { translate } from '../../app/Services/odds/books/pinnacle'
import { fromAmericanNumber } from '../../app/Support/keys'

/**
 * The Pinnacle adapter, against responses Pinnacle actually sent.
 *
 * Two MLB games with their real markets, including the child matchups and
 * the `team_total` markets that have to be filtered out — a fixture that
 * only contained the happy path would not prove the filtering works, and
 * the filtering is where the damage would be.
 */

const events = translate((fixture as any).matchups, (fixture as any).markets, 'mlb')

describe('translate', () => {
  it('joins markets onto matchups on matchupId', () => {
    expect(events).toHaveLength(2)
    expect(events[0]!.books[0]!.markets.length).toBeGreaterThan(0)
  })

  it('drops child matchups rather than making each its own event', () => {
    // The fixture contains children. Treating them as events would
    // multiply the board with derivative markets.
    const parents = (fixture as any).matchups.filter((m: any) => m.parentId == null)
    const children = (fixture as any).matchups.filter((m: any) => m.parentId != null)

    expect(children.length).toBeGreaterThan(0)
    expect(events).toHaveLength(parents.length)
  })

  it('takes home and away from alignment', () => {
    const game = events[0]!
    expect(game.homeTeam).toBeTruthy()
    expect(game.awayTeam).toBeTruthy()
    expect(game.homeTeam).not.toBe(game.awayTeam)
  })

  it('converts American prices to decimal', () => {
    const moneyline = events.find(e => e.externalId === '1633197945')!.books[0]!
      .markets.find(m => m.marketType === 'h2h' && m.period === 'full_game')!

    const home = moneyline.outcomes.find(o => o.side === 'home')!
    // -137 American is 1.7299 decimal.
    expect(home.price).toBeCloseTo(fromAmericanNumber(-137), 6)
    expect(home.price).toBeCloseTo(1.7299, 3)

    const away = moneyline.outcomes.find(o => o.side === 'away')!
    expect(away.price).toBeCloseTo(2.24, 2)
  })

  it('never emits a price at or below evens-with-no-return', () => {
    for (const event of events) {
      for (const market of event.books[0]!.markets) {
        for (const outcome of market.outcomes)
          expect(outcome.price).toBeGreaterThan(1)
      }
    }
  })

  it('carries the published stake limit, which is the reason to read Pinnacle', () => {
    const moneyline = events.find(e => e.externalId === '1633197945')!.books[0]!
      .markets.find(m => m.marketType === 'h2h' && m.period === 'full_game')!

    expect(moneyline.outcomes[0]!.limitAmount).toBe(2500)
  })

  it('excludes team_total, which is not the game total', () => {
    // Mapping it onto `totals` would pair a team's over against the game's
    // under and de-vig to a number that means nothing.
    const raw = (fixture as any).markets.filter((m: any) => m.type === 'team_total')
    expect(raw.length).toBeGreaterThan(0)

    const totals = events.flatMap(e => e.books[0]!.markets).filter(m => m.marketType === 'totals')
    const gameTotals = (fixture as any).markets.filter((m: any) => m.type === 'total')

    // Every translated total came from a `total`, never a `team_total`.
    expect(totals.length).toBeLessThanOrEqual(gameTotals.length)
  })

  it('names periods rather than passing the raw integer through', () => {
    const periods = new Set(events.flatMap(e => e.books[0]!.markets).map(m => m.period))
    expect(periods.has('full_game')).toBe(true)
    // A bare `1` would compare equal across sports where it means
    // different spans of play.
    expect([...periods].every(p => typeof p === 'string')).toBe(true)
  })

  it('keeps alternate lines as separate markets', () => {
    const totals = events.flatMap(e => e.books[0]!.markets)
      .filter(m => m.marketType === 'totals' && m.period === 'full_game')

    // A ladder is more market than a single number, and each line is its
    // own market by our convention.
    const lines = new Set(totals.map(m => m.line))
    expect(lines.size).toBeGreaterThan(1)
  })

  it('signs the spread from the home team', () => {
    const spread = events.flatMap(e => e.books[0]!.markets)
      .find(m => m.marketType === 'spreads' && m.line !== null)!

    const home = spread.outcomes.find(o => o.side === 'home')!
    expect(spread.line).toBe(home.point)
  })

  it('attributes everything to the pinnacle book key', () => {
    expect(events[0]!.books[0]!.key).toBe('pinnacle')
  })

  it('skips a suspended market rather than showing an untakeable price', () => {
    const suspended = translate(
      [{ id: 1, startTime: '2026-08-08T00:00:00Z', participants: [{ alignment: 'home', name: 'A' }, { alignment: 'away', name: 'B' }] }],
      [{ matchupId: 1, type: 'moneyline', period: 0, status: 'suspended', prices: [{ designation: 'home', price: -110 }, { designation: 'away', price: -110 }] }],
      'mlb',
    )

    expect(suspended).toHaveLength(0)
  })

  it('drops a market whose type it does not map', () => {
    const unknown = translate(
      [{ id: 1, startTime: '2026-08-08T00:00:00Z', participants: [{ alignment: 'home', name: 'A' }, { alignment: 'away', name: 'B' }] }],
      [{ matchupId: 1, type: 'team_total', period: 0, status: 'open', prices: [{ designation: 'over', points: 4.5, price: -110 }, { designation: 'under', points: 4.5, price: -110 }] }],
      'mlb',
    )

    expect(unknown).toHaveLength(0)
  })

  it('survives empty inputs', () => {
    expect(translate([], [], 'mlb')).toEqual([])
  })
})

describe('fromAmericanNumber', () => {
  it('converts both directions of the notation', () => {
    expect(fromAmericanNumber(100)).toBe(2)
    expect(fromAmericanNumber(-100)).toBe(2)
    expect(fromAmericanNumber(150)).toBeCloseTo(2.5, 6)
    expect(fromAmericanNumber(-200)).toBeCloseTo(1.5, 6)
  })

  it('rejects the band the notation cannot express', () => {
    // There is no American price between -100 and +100; a value there is
    // malformed, not very short, and must not become a plausible decimal.
    expect(fromAmericanNumber(50)).toBe(0)
    expect(fromAmericanNumber(-50)).toBe(0)
    expect(fromAmericanNumber(0)).toBe(0)
    expect(fromAmericanNumber(Number.NaN)).toBe(0)
  })
})
