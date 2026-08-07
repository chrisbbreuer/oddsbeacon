import { describe, expect, it } from 'bun:test'
import fixture from '../fixtures/draftkings-mlb.json'
import { buildUrl, translate } from '../../app/Services/odds/books/draftkings'

/**
 * The DraftKings adapter, against a response DraftKings actually sent.
 *
 * The fixture is a real payload — two MLB games, trimmed — rather than a
 * hand-written approximation. That distinction is the whole point of this
 * file: an adapter tested against an assumed shape passes its own tests
 * and fails on first contact, which is worse than no adapter because it
 * claims coverage we do not have.
 *
 * What breaks here is a change to DraftKings' payload. That is exactly the
 * thing that should fail loudly rather than degrade into a quiet board.
 */

describe('translate', () => {
  const events = translate(fixture as any, 'mlb')

  it('reads both games out of the flat arrays', () => {
    expect(events).toHaveLength(2)
  })

  it('takes home and away from venueRole, not array order', () => {
    // Order is undocumented; a reversed fixture would swap every home and
    // away price on the board while still looking plausible.
    const game = events.find(e => e.homeTeam === 'PHI Phillies')
    expect(game).toBeDefined()
    expect(game!.awayTeam).toBe('TOR Blue Jays')
  })

  it('carries the book id so a second pass joins on it', () => {
    expect(events[0]!.externalId).toMatch(/^\d+$/)
  })

  it('normalises the start time to ISO', () => {
    expect(events[0]!.commenceAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
  })

  it('translates all three market types, keyed on id not name', () => {
    // MLB calls the spread "Run Line" and the NFL calls it "Spread"; both
    // are marketType.id '2_0'. Matching on the label would drop this.
    const types = events[0]!.books[0]!.markets.map(m => m.marketType).sort()
    expect(types).toEqual(['h2h', 'spreads', 'totals'])
  })

  it('maps outcome types onto our own sides', () => {
    const moneyline = events[0]!.books[0]!.markets.find(m => m.marketType === 'h2h')!
    expect(moneyline.outcomes.map(o => o.side).sort()).toEqual(['away', 'home'])

    const total = events[0]!.books[0]!.markets.find(m => m.marketType === 'totals')!
    expect(total.outcomes.map(o => o.side).sort()).toEqual(['over', 'under'])
  })

  it('reads decimal prices straight off trueOdds', () => {
    const moneyline = events.find(e => e.homeTeam === 'PHI Phillies')!.books[0]!
      .markets.find(m => m.marketType === 'h2h')!

    const home = moneyline.outcomes.find(o => o.side === 'home')!
    // The real quoted price in the recorded payload.
    expect(home.price).toBeCloseTo(1.4484, 3)
    expect(home.price).toBeGreaterThan(1)
  })

  it('signs the spread from the home team', () => {
    const spread = events.find(e => e.homeTeam === 'PHI Phillies')!.books[0]!
      .markets.find(m => m.marketType === 'spreads')!

    const home = spread.outcomes.find(o => o.side === 'home')!
    expect(home.point).toBe(-1.5)
    // Our convention: the market's line is the home handicap.
    expect(spread.line).toBe(-1.5)
  })

  it('puts the same total on both sides', () => {
    const total = events[0]!.books[0]!.markets.find(m => m.marketType === 'totals')!
    const points = total.outcomes.map(o => o.point)
    expect(new Set(points).size).toBe(1)
    expect(total.line).toBe(points[0])
  })

  it('leaves a moneyline with no line', () => {
    const moneyline = events[0]!.books[0]!.markets.find(m => m.marketType === 'h2h')!
    expect(moneyline.line).toBeNull()
    expect(moneyline.outcomes.every(o => o.point === null)).toBe(true)
  })

  it('records the book\'s own selection id', () => {
    const outcome = events[0]!.books[0]!.markets[0]!.outcomes[0]!
    expect(outcome.sid).toBeTruthy()
  })

  it('attributes everything to the draftkings book key', () => {
    // Must match Bookmaker.slug or the prices are silently dropped.
    expect(events[0]!.books[0]!.key).toBe('draftkings')
  })

  it('drops a market type it does not recognise', () => {
    const unknown = {
      events: (fixture as any).events.slice(0, 1),
      markets: [{ id: 'm1', eventId: (fixture as any).events[0].id, marketType: { id: '99_0', name: 'Mystery' } }],
      selections: [
        { id: 's1', marketId: 'm1', label: 'A', outcomeType: 'Home', trueOdds: 2 },
        { id: 's2', marketId: 'm1', label: 'B', outcomeType: 'Away', trueOdds: 2 },
      ],
    }

    // A market we cannot confidently name is worse than one we skip: a
    // mislabelled market gets de-vigged against the wrong pair.
    expect(translate(unknown as any, 'mlb')).toHaveLength(0)
  })

  it('drops a one-sided market rather than storing something undevigable', () => {
    const oneSided = {
      events: (fixture as any).events.slice(0, 1),
      markets: [{ id: 'm1', eventId: (fixture as any).events[0].id, marketType: { id: '1_0' } }],
      selections: [{ id: 's1', marketId: 'm1', label: 'A', outcomeType: 'Home', trueOdds: 2 }],
    }

    expect(translate(oneSided as any, 'mlb')).toHaveLength(0)
  })

  it('drops an impossible price rather than storing it', () => {
    const bad = {
      events: (fixture as any).events.slice(0, 1),
      markets: [{ id: 'm1', eventId: (fixture as any).events[0].id, marketType: { id: '1_0' } }],
      selections: [
        { id: 's1', marketId: 'm1', label: 'A', outcomeType: 'Home', trueOdds: 1 },
        { id: 's2', marketId: 'm1', label: 'B', outcomeType: 'Away', trueOdds: 0 },
      ],
    }

    // A decimal price of 1 pays nothing back; it is a parse failure.
    expect(translate(bad as any, 'mlb')).toHaveLength(0)
  })

  it('skips an event missing a participant rather than half-resolving it', () => {
    const headless = {
      events: [{ id: '1', startEventDate: '2026-08-07T22:40:00Z', participants: [{ name: 'X', venueRole: 'Home' }] }],
      markets: [{ id: 'm1', eventId: '1', marketType: { id: '1_0' } }],
      selections: [
        { id: 's1', marketId: 'm1', label: 'A', outcomeType: 'Home', trueOdds: 2 },
        { id: 's2', marketId: 'm1', label: 'B', outcomeType: 'Away', trueOdds: 2 },
      ],
    }

    expect(translate(headless as any, 'mlb')).toHaveLength(0)
  })

  it('survives an empty payload', () => {
    expect(translate({}, 'mlb')).toEqual([])
  })
})

describe('buildUrl', () => {
  it('encodes the OData filters the endpoint requires', () => {
    const url = buildUrl('84240', '4519')
    expect(url).toContain('templateVars=84240%2C4519')
    // Percent-encoded spaces, not '+'. The endpoint answers '+' inside
    // these filters with a 403, so this assertion is load-bearing.
    expect(url).toContain('leagueId%20eq%20%2784240%27')
    expect(url).not.toContain('+')
    expect(url).toContain('entity=events')
  })
})
