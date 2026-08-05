import type { Database } from 'bun:sqlite'
import { loadSports, resolveExistingTeam } from './resolve'

/**
 * Reading a Kalshi game market back to the two teams playing.
 *
 * Kalshi lists club fixtures as one market per outcome, all sharing a
 * title and distinguished by a subtitle:
 *
 *   ticker  KXEFLCUPGAME-26AUG08WATCRA-WAT
 *   title   Watford vs Crawley Winner?
 *   yes_sub Reg Time: Watford
 *
 * Which matters because the interesting fixtures are the lopsided ones.
 * `KXEFLCUPGAME` pairs a second-division side with a fourth-division one
 * routinely, and the only way to know that is to get from "Watford" to a
 * row in `sports_teams` and from there to its tier and squad value. The
 * price alone cannot tell you, because the price is what is in question.
 *
 * Everything here is a pure function over strings. The Kalshi market
 * catalogue is public and unauthenticated, so nothing in this file needs
 * a credential; only placing an order does, and that is not done here.
 */

/** Series that list a club or national fixture as a three-way winner market. */
export const GAME_SERIES: Record<string, { sportSlug: string, competition: string }> = {
  KXEPLGAME: { sportSlug: 'epl', competition: 'Premier League' },
  KXLALIGAGAME: { sportSlug: 'laliga', competition: 'LaLiga' },
  KXSERIEAGAME: { sportSlug: 'seriea', competition: 'Serie A' },
  KXBUNDESLIGAGAME: { sportSlug: 'bundesliga', competition: 'Bundesliga' },
  KXUCLGAME: { sportSlug: 'ucl', competition: 'Champions League' },
  KXUEFAGAME: { sportSlug: 'ucl', competition: 'UEFA' },
  KXUEFANLGAME: { sportSlug: 'uefa-nations', competition: 'UEFA Nations League' },
  // Cups and friendlies: the mismatch cases, and the reason any of this
  // exists. Mapped to a league only so team names resolve; the tier comes
  // from each club's own valuation row, never from the competition, since
  // a cup tie's whole point is that the two sides are from different ones.
  KXEFLCUPGAME: { sportSlug: 'epl', competition: 'EFL Cup' },
  KXEFLL1GAME: { sportSlug: 'epl', competition: 'EFL League One' },
  KXCOPADELREYGAME: { sportSlug: 'laliga', competition: 'Copa del Rey' },
  KXEREDIVISIEGAME: { sportSlug: 'epl', competition: 'Eredivisie' },
  KXCZEFLGAME: { sportSlug: 'epl', competition: 'Czech First League' },
  KXLIGUE1GAME: { sportSlug: 'epl', competition: 'Ligue 1' },
  KXINTLFRIENDLYGAME: { sportSlug: 'intl-friendly', competition: 'International Friendly' },
}

export interface ParsedGame {
  home: string
  away: string
}

/**
 * Pull the two sides out of a title.
 *
 * Kalshi writes these as `{Home} vs {Away} Winner?`. Home is first,
 * matching how every other feed in this system orders a fixture, so the
 * caller does not have to know which convention it is looking at.
 */
export function parseGameTitle(title: unknown): ParsedGame | null {
  const text = String(title ?? '').trim()
  if (!text)
    return null

  // Two steps rather than one clever expression. Strip the trailing
  // question first ('Winner?', 'To Advance?'), then split on the
  // separator, because a single regex doing both needs a lazy capture
  // whose failure mode is silent: it yields a team called 'Crawley
  // Winner' and every downstream lookup misses without saying so.
  const withoutSuffix = text
    .replace(/\s*\?+\s*$/, '')
    .replace(/\s+(?:winner|to advance|result)$/i, '')
    .trim()

  const match = withoutSuffix.match(/^(.+)\s+(?:vs\.?|v)\s+(.+)$/i)
  if (!match)
    return null

  const home = (match[1] ?? '').trim()
  const away = (match[2] ?? '').trim()

  if (!home || !away)
    return null

  return { home, away }
}

/**
 * Which side a single outcome market is on.
 *
 * The subtitle carries a qualifier on some series (`Reg Time: Watford`)
 * and not on others (`Watford`), and a draw is its own market. Returning
 * the bare team name, or 'tie', lets the caller match it against the
 * parsed fixture without every series needing its own branch.
 */
export function parseOutcomeSide(subTitle: unknown): string | null {
  const text = String(subTitle ?? '').trim()
  if (!text)
    return null

  // Strip a leading qualifier such as 'Reg Time: ' or '90 Minutes: '.
  const stripped = text.includes(':') ? text.slice(text.indexOf(':') + 1).trim() : text
  if (!stripped)
    return null

  if (/^(?:tie|draw)$/i.test(stripped))
    return 'tie'

  return stripped
}

const normalizeName = (name: string) => name.toUpperCase().replace(/[^A-Z]/g, '')

/**
 * Which of the three outcomes a single market represents.
 *
 * Two sources, and the subtitle is much the better one. It carries the
 * side by name (`Reg Time: Watford`, `Guatemala`), so it settles the
 * question exactly. The ticker suffix is a fallback for markets that
 * arrive without one.
 *
 * That fallback is genuinely weak, and deliberately so rather than
 * cleverly so. Kalshi abbreviates clubs by prefix (`-WAT` for Watford)
 * but national teams by FIFA code (`-AUT` for Austria, whose first three
 * letters are AUS, and `-GTM` for Guatemala). Prefix matching therefore
 * resolves club fixtures and quietly declines international ones. Adding
 * a fuzzier match would resolve more of them and would sooner or later
 * resolve one of them wrongly.
 *
 * Which is the whole design here: a mismatch signal applied to the wrong
 * side argues confidently for the team the evidence is against, so every
 * ambiguity returns null and the signal simply does not fire.
 */
export function outcomeSideOf(
  ticker: unknown,
  fixture: { home: string, away: string },
  subTitle?: unknown,
): 'home' | 'away' | 'tie' | null {
  const home = normalizeName(fixture.home)
  const away = normalizeName(fixture.away)

  // Preferred: the subtitle names the side outright.
  const named = parseOutcomeSide(subTitle)
  if (named) {
    if (named === 'tie')
      return 'tie'

    const candidate = normalizeName(named)
    if (candidate) {
      const homeNamed = candidate === home || home.includes(candidate) || candidate.includes(home)
      const awayNamed = candidate === away || away.includes(candidate) || candidate.includes(away)
      if (homeNamed !== awayNamed)
        return homeNamed ? 'home' : 'away'
    }
  }

  // Fallback: the ticker's trailing abbreviation.
  const text = String(ticker ?? '').trim().toUpperCase()
  const cut = text.lastIndexOf('-')
  if (cut === -1)
    return null

  const suffix = text.slice(cut + 1)
  if (!suffix)
    return null

  if (suffix === 'TIE' || suffix === 'DRAW')
    return 'tie'

  const homeMatch = home.startsWith(suffix)
  const awayMatch = away.startsWith(suffix)

  // Both or neither is unusable. Two clubs sharing a prefix in one
  // fixture is rare but real, and guessing between them is the one
  // failure this cannot afford.
  if (homeMatch === awayMatch)
    return null

  return homeMatch ? 'home' : 'away'
}

export interface ResolvedFixture {
  seriesTicker: string
  competition: string
  sportSlug: string
  home: string
  away: string
  homeTeamId: number | null
  awayTeamId: number | null
  /** Our own fixture row for the same game, when one exists. */
  marketEventId: number | null
  /** That fixture's kickoff, which rest and congestion are measured from. */
  commenceAt: string | null
  /** True when both sides resolved to rows we hold fundamentals for. */
  matched: boolean
}

/** Series ticker is everything before the first hyphen. */
export function seriesTickerOf(ticker: unknown): string {
  const text = String(ticker ?? '').trim().toUpperCase()
  const cut = text.indexOf('-')
  return cut === -1 ? text : text.slice(0, cut)
}

/**
 * Resolve a Kalshi market to the two clubs it is about.
 *
 * Returns null for a series this does not cover rather than guessing:
 * player props and team totals share the naming convention but are not
 * fixtures, and treating one as a fixture would attach a mismatch read to
 * a market where it means nothing.
 */
export function resolveFixture(db: Database, market: { ticker?: string, title?: string }): ResolvedFixture | null {
  const seriesTicker = seriesTickerOf(market.ticker)
  const series = GAME_SERIES[seriesTicker]
  if (!series)
    return null

  const parsed = parseGameTitle(market.title)
  if (!parsed)
    return null

  const sports = loadSports(db)
  const fallback = sports.find(s => s.slug === series.sportSlug)
  if (!fallback)
    return null

  /**
   * Find the club in whichever division it actually plays in.
   *
   * A cup tie is precisely the case where the two sides are NOT in the
   * same league, so resolving both under one slug is wrong in the one
   * situation this exists to handle: it created a second Watford and a
   * second Crawley under the Premier League, both tier 1, and the
   * mismatch read tier 1 against tier 1 and saw nothing.
   *
   * So look across every league of the same kind first and only fall
   * back to creating a row when the club is genuinely unknown to us.
   */
  const findExisting = (name: string): number | null => {
    for (const candidate of sports) {
      if (candidate.grouping !== fallback.grouping)
        continue

      const existing = resolveExistingTeam(db, candidate.id, name)
      if (existing !== null)
        return existing
    }
    return null
  }

  // Match only, never create. An unknown club invented under whichever
  // league the series happens to map to would be stamped with that
  // league's tier, and a fabricated tier is worse than no tier: it turns
  // a fixture we cannot read into one we read confidently and wrongly.
  // Crawley arriving as 'Crawley' against ESPN's 'Crawley Town' did
  // exactly that, landing a fourth-division club in the Premier League.
  const homeTeamId = findExisting(parsed.home)
  const awayTeamId = findExisting(parsed.away)

  // Link to our own fixture row so schedule history is reachable. Matched
  // on the two clubs rather than on names, and left null when we hold no
  // such fixture, which is normal for a market listed before the
  // scoreboard feed has published the game.
  let marketEventId: number | null = null
  let commenceAt: string | null = null

  if (homeTeamId !== null && awayTeamId !== null) {
    const event = db.query(`
      SELECT id, commence_at FROM market_events
      WHERE home_sports_team_id = ? AND away_sports_team_id = ? AND commence_at != ''
      ORDER BY commence_at DESC LIMIT 1
    `).get(homeTeamId, awayTeamId) as { id: number, commence_at: string } | null

    if (event) {
      marketEventId = event.id
      commenceAt = event.commence_at
    }
  }

  return {
    seriesTicker,
    competition: series.competition,
    sportSlug: series.sportSlug,
    home: parsed.home,
    away: parsed.away,
    homeTeamId,
    awayTeamId,
    marketEventId,
    commenceAt,
    matched: homeTeamId !== null && awayTeamId !== null,
  }
}
