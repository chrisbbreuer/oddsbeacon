import { describe, expect, it } from 'bun:test'
import { assessMismatch, type TeamFundamentals } from '../../app/Services/fundamentals/mismatch'
import { injurySeverity } from '../../app/Services/fundamentals/severity'
import { parseMarketValue, parseTransfermarktClubs } from '../../app/Services/fundamentals/transfermarkt'

/**
 * The mismatch read is the only input in this system that can disagree
 * with a bookmaker rather than restate it, so the thing worth testing is
 * that it stays silent when it has nothing to say. A signal that invents
 * an edge from missing data is worse than no signal: it would fire on
 * exactly the obscure fixtures where nobody can check it.
 */

function team(overrides: Partial<TeamFundamentals> = {}): TeamFundamentals {
  return {
    teamId: 1,
    leagueTier: 0,
    squadValueEur: 0,
    winPercent: 0,
    pointDifferential: 0,
    gamesPlayed: 0,
    injuryBurden: 0,
    hasStanding: false,
    hasValuation: false,
    ...overrides,
  }
}

describe('assessMismatch', () => {
  it('says nothing when it knows nothing', () => {
    const result = assessMismatch(team(), team())

    expect(result.edge).toBe(0)
    expect(result.confidence).toBe(0)
    expect(result.reasons).toEqual([])
  })

  it('favours the higher division in a cup tie', () => {
    // Watford (2nd tier) vs Crawley (4th), the KXEFLCUPGAME case.
    const result = assessMismatch(
      team({ leagueTier: 2, hasValuation: true }),
      team({ leagueTier: 4, hasValuation: true }),
    )

    expect(result.edge).toBeGreaterThan(0)
    expect(result.reasons[0]).toContain('Tier 2 vs tier 4')
  })

  it('is symmetric, so the same fixture reversed flips sign', () => {
    const home = team({ leagueTier: 1, hasValuation: true })
    const away = team({ leagueTier: 4, hasValuation: true })

    expect(assessMismatch(home, away).edge).toBeCloseTo(-assessMismatch(away, home).edge, 6)
  })

  it('reads squad value as a ratio rather than a difference', () => {
    // 900 vs 450 and 200 vs 100 are the same story at different scales.
    const big = assessMismatch(
      team({ squadValueEur: 900e6 }),
      team({ squadValueEur: 450e6 }),
    )
    const small = assessMismatch(
      team({ squadValueEur: 200e6 }),
      team({ squadValueEur: 100e6 }),
    )

    expect(big.edge).toBeCloseTo(small.edge, 6)
  })

  it('ignores form on a sample too small to mean anything', () => {
    const early = assessMismatch(
      team({ winPercent: 1, gamesPlayed: 2, hasStanding: true }),
      team({ winPercent: 0, gamesPlayed: 2, hasStanding: true }),
    )

    // A 2-0 start against an 0-2 start is noise, not evidence.
    expect(early.edge).toBe(0)
    expect(early.confidence).toBe(0)
  })

  it('uses form once the sample is real', () => {
    const settled = assessMismatch(
      team({ winPercent: 0.7, gamesPlayed: 60, pointDifferential: 90, hasStanding: true }),
      team({ winPercent: 0.4, gamesPlayed: 60, pointDifferential: -40, hasStanding: true }),
    )

    expect(settled.edge).toBeGreaterThan(0)
    expect(settled.confidence).toBeGreaterThan(0)
  })

  it('is more confident when more sources agree than when one shouts', () => {
    const oneSource = assessMismatch(
      team({ leagueTier: 1, hasValuation: true }),
      team({ leagueTier: 4, hasValuation: true }),
    )
    const manySources = assessMismatch(
      team({ leagueTier: 1, squadValueEur: 900e6, winPercent: 0.8, gamesPlayed: 40, pointDifferential: 100, hasStanding: true, hasValuation: true }),
      team({ leagueTier: 4, squadValueEur: 20e6, winPercent: 0.3, gamesPlayed: 40, pointDifferential: -60, hasStanding: true, hasValuation: true }),
    )

    expect(manySources.confidence).toBeGreaterThan(oneSource.confidence)
    expect(manySources.reasons.length).toBeGreaterThan(oneSource.reasons.length)
  })

  it('treats injuries as a nudge, never a verdict', () => {
    const injuriesOnly = assessMismatch(
      team({ injuryBurden: 0 }),
      team({ injuryBurden: 9 }),
    )

    expect(injuriesOnly.edge).toBeGreaterThan(0)
    // Coarse severity over an unknown set of players cannot carry a call.
    expect(injuriesOnly.edge).toBeLessThan(0.5)
  })

  it('never exceeds the bounds it promises', () => {
    const extreme = assessMismatch(
      team({ leagueTier: 1, squadValueEur: 2e9, winPercent: 1, gamesPlayed: 100, pointDifferential: 900, injuryBurden: 0, hasStanding: true, hasValuation: true }),
      team({ leagueTier: 12, squadValueEur: 1e5, winPercent: 0, gamesPlayed: 100, pointDifferential: -900, injuryBurden: 40, hasStanding: true, hasValuation: true }),
    )

    expect(extreme.edge).toBeLessThanOrEqual(1)
    expect(extreme.confidence).toBeLessThanOrEqual(1)
  })
})

describe('injurySeverity', () => {
  it('orders the statuses the way the leagues mean them', () => {
    expect(injurySeverity('Active')).toBe(0)
    expect(injurySeverity('Day-To-Day')).toBeLessThan(injurySeverity('Questionable'))
    expect(injurySeverity('Questionable')).toBeLessThan(injurySeverity('Doubtful'))
    expect(injurySeverity('Doubtful')).toBeLessThan(injurySeverity('Out'))
    expect(injurySeverity('60-Day-IL')).toBe(1)
  })

  it('prefers the longest match, so day-to-day is not read as out', () => {
    // 'Day-To-Day' contains neither 'out' nor 'active', but the guard
    // matters for statuses where one token is a substring of another.
    expect(injurySeverity('Day-To-Day')).toBe(0.3)
  })

  it('treats an unrecognised status as a real absence', () => {
    // A feed only lists a player when something is wrong, so an unknown
    // wording should not be read as available.
    expect(injurySeverity('Reconditioning')).toBe(0.5)
  })

  it('is empty-safe', () => {
    expect(injurySeverity('')).toBe(0)
    expect(injurySeverity(null)).toBe(0)
  })
})

describe('parseMarketValue', () => {
  it('reads the units Transfermarkt publishes', () => {
    expect(parseMarketValue('€1.20bn')).toBe(1_200_000_000)
    expect(parseMarketValue('450.00m')).toBe(450_000_000)
    expect(parseMarketValue('900k')).toBe(900_000)
    expect(parseMarketValue('€75m')).toBe(75_000_000)
  })

  it('passes a plain number through', () => {
    expect(parseMarketValue(12_345)).toBe(12_345)
  })

  it('returns zero rather than guessing at nonsense', () => {
    expect(parseMarketValue('unknown')).toBe(0)
    expect(parseMarketValue('')).toBe(0)
    expect(parseMarketValue(null)).toBe(0)
  })
})

describe('parseTransfermarktClubs', () => {
  it('keeps every club fact attached to its Transfermarkt DOM row', () => {
    const clubs = parseTransfermarktClubs(`
      <table class="items">
        <tbody>
          <tr><td colspan="7">Clubs - Premier League</td></tr>
          <tr class="odd">
            <td class="zentriert"><a href="/brighton/startseite/verein/123"><img alt="Brighton"></a></td>
            <td class="hauptlink no-border-links"><a title="Brighton &amp; Hove Albion" href="/brighton/startseite/verein/123/saison_id/2026">Brighton &amp; Hove Albion</a></td>
            <td class="zentriert">33</td><td class="zentriert">26.6</td><td class="zentriert">21</td>
            <td class="rechts">€16.73m</td><td class="rechts hauptlink"><a href="/brighton/marktwert/verein/123">€552.00m</a></td>
          </tr>
          <tr class="even">
            <td class="zentriert"><a href="/arsenal/startseite/verein/11"><img alt="Arsenal"></a></td>
            <td class="hauptlink no-border-links"><a title="Arsenal FC" href="/arsenal/startseite/verein/11/saison_id/2026">Arsenal FC</a></td>
            <td class="zentriert">24</td><td class="zentriert">26.3</td><td class="zentriert">17</td>
            <td class="rechts">€51.21m</td><td class="rechts hauptlink"><a href="/arsenal/marktwert/verein/11">€1.23bn</a></td>
          </tr>
        </tbody>
      </table>
      <table class="items"><tbody><tr><td class="hauptlink"><a href="/player/profil/spieler/9">Player</a></td></tr></tbody></table>
    `)

    expect(clubs).toEqual([
      { externalId: '123', name: 'Brighton & Hove Albion', squadSize: 33, averageAgeYears: 26.6, marketValueEur: 552_000_000 },
      { externalId: '11', name: 'Arsenal FC', squadSize: 24, averageAgeYears: 26.3, marketValueEur: 1_230_000_000 },
    ])
  })
})
