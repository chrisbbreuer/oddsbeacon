import type { SportRow } from '../../ingest/resolve'
import type { FeedBook, FeedEvent, FeedMarket, FeedOutcome } from '../provider'
import type { BookAdapter, BookContext } from './adapter'
import process from 'node:process'
import { fromAmericanNumber } from '../../../Support/keys'

/**
 * Pinnacle, read from the API its own site calls.
 *
 * The most valuable adapter in the set. Pinnacle is a low-margin,
 * high-limit book that welcomes winning bettors, so its price carries far
 * more information than a recreational book copying the market — which is
 * why `Bookmaker` seeds it at `consensusWeight: 4` and `sharp: true`, and
 * why the fair-value anchor is drawn from it.
 *
 * ### Two calls, joined on `matchupId`
 *
 * Matchups (the fixtures) and markets (the prices) are separate endpoints
 * per league, joined on `matchupId`. That is two requests where DraftKings
 * needed one, and it is still one pair per league rather than per game.
 *
 * ### Prices are American integers
 *
 * Not decimal. `fromAmericanNumber` converts, and the band between -100
 * and +100 that the notation cannot express is treated as malformed rather
 * than as a very short price.
 *
 * ### The limits are the point
 *
 * `limits[].amount` is the maximum stake Pinnacle will accept on that
 * market. Almost no book publishes this, and it is the difference between
 * "the sharp price is X" and "the sharp price is X and you can get $2,500
 * down on it". It fills `Odd.limitAmount`, which the trading engine reads
 * before sizing.
 *
 * ### Alternate lines are kept
 *
 * `isAlternate` markets are stored like any other, because
 * `FeedMarket.line` already makes each distinct line its own market. A
 * book quoting a ladder is offering more market than one quoting a single
 * number, and flattening that away loses the shape of the book.
 *
 * ### The key is a guest key
 *
 * `X-API-Key` below is the anonymous key Pinnacle ships in its own web
 * bundle for logged-out browsing — a public client constant, not a
 * credential belonging to anyone. `PINNACLE_API_KEY` overrides it for when
 * they rotate it.
 */

const BASE = 'https://guest.api.arcadia.pinnacle.com/0.1'

/** Pinnacle's public guest key. Overridable when they rotate it. */
const API_KEY = process.env.PINNACLE_API_KEY || 'CmX2KcMrXuFmNg6YFbmTxE0y9CIrOi0R'

/**
 * Our sport slug to Pinnacle's league id.
 *
 * **Every id here was confirmed against a live response with a non-zero
 * matchup count.** That matters: an out-of-season league returns an empty
 * list, which is indistinguishable from a wrong id, so an unverified entry
 * would record a guess as a fact.
 *
 * Pinnacle covers more of our catalog than DraftKings does — NBA and NHL
 * are both here, with live matchups, in August.
 */
const LEAGUES: Record<string, number> = {
  // Baseball, American football, basketball, hockey.
  'mlb': 246,
  'nfl': 889,
  'ncaaf': 880,
  'nba': 487,
  'ncaab': 493,
  'nhl': 1456,

  // Soccer.
  'epl': 1980,
  'efl-championship': 1977,
  'efl-league-one': 1957,
  'efl-league-two': 1958,
  'laliga': 2196,
  'seriea': 2436,
  'bundesliga': 1842,
  'bundesliga2': 1843,
  'ligue1': 2036,
  'eredivisie': 1928,
}

/**
 * Pinnacle's market types to ours.
 *
 * `team_total` is deliberately absent. It is a real market, but it is a
 * total for *one side* rather than for the game, and mapping it onto
 * `totals` would put two incompatible markets on the same line — the
 * de-vig would then pair a team's over against the game's under and
 * produce a fair value that means nothing.
 */
const MARKET_TYPES: Record<string, string> = {
  moneyline: 'h2h',
  spread: 'spreads',
  total: 'totals',
}

/** Pinnacle's price designations to our sides. */
const SIDES: Record<string, string> = {
  home: 'home',
  away: 'away',
  draw: 'draw',
  over: 'over',
  under: 'under',
}

const HEADERS: Record<string, string> = {
  'accept': 'application/json',
  'content-type': 'application/json',
  'referer': 'https://www.pinnacle.com/',
  'x-api-key': API_KEY,
  'x-device-uuid': 'null',
}

interface PinParticipant { alignment?: string, name?: string }

interface PinMatchup {
  id?: number
  parentId?: number | null
  startTime?: string
  isLive?: boolean
  status?: string
  participants?: PinParticipant[]
}

interface PinPrice {
  designation?: string
  points?: number
  price?: number
}

interface PinMarket {
  matchupId?: number
  type?: string
  period?: number
  side?: string
  status?: string
  isAlternate?: boolean
  prices?: PinPrice[]
  limits?: Array<{ amount?: number, type?: string }>
}

/**
 * Period 0 is the full game everywhere; the rest are sport-specific.
 *
 * Named rather than passed through as a number, because `period: 1` means
 * a different span of play in baseball than in soccer and storing the raw
 * integer would make two unlike markets compare equal.
 */
function periodName(period: number | undefined, sportSlug: string): string {
  if (!period)
    return 'full_game'

  const soccer = !['mlb', 'nfl', 'ncaaf', 'nba', 'ncaab', 'nhl'].includes(sportSlug)
  if (soccer)
    return period === 1 ? 'first_half' : `period_${period}`

  return `period_${period}`
}

/**
 * Translate one league's matchups and markets into the shared feed shape.
 *
 * Exported so the join can be tested against recorded responses — this is
 * the half that breaks when Pinnacle changes its payload.
 */
export function translate(
  matchups: PinMatchup[],
  markets: PinMarket[],
  sportSlug: string,
): FeedEvent[] {
  const marketsByMatchup = new Map<number, PinMarket[]>()
  for (const market of markets) {
    const id = Number(market.matchupId)
    if (!Number.isFinite(id))
      continue
    const list = marketsByMatchup.get(id) ?? []
    list.push(market)
    marketsByMatchup.set(id, list)
  }

  const events: FeedEvent[] = []

  for (const matchup of matchups) {
    // Children are derivative markets hung off a game — corners, bookings,
    // alternate presentations. Their prices belong to the parent fixture,
    // and treating each as its own event would multiply the board.
    if (matchup.parentId != null)
      continue

    const externalId = String(matchup.id ?? '')
    const commenceAt = matchup.startTime ? new Date(matchup.startTime).toISOString() : ''

    let home = ''
    let away = ''
    for (const participant of matchup.participants ?? []) {
      if (participant.alignment === 'home')
        home = String(participant.name ?? '')
      else if (participant.alignment === 'away')
        away = String(participant.name ?? '')
    }

    if (!externalId || !commenceAt || !home || !away)
      continue

    const feedMarkets: FeedMarket[] = []

    for (const market of marketsByMatchup.get(Number(matchup.id)) ?? []) {
      const marketType = MARKET_TYPES[String(market.type ?? '')]
      if (!marketType)
        continue

      // A suspended market is a price nobody can take. Storing it would
      // let the edge screen surface a bet that cannot be placed.
      if (market.status && market.status !== 'open')
        continue

      // The largest published limit for this market. Pinnacle lists them
      // by type; `maxRiskStake` is the one that bounds a bet.
      const limitAmount = (market.limits ?? [])
        .map(limit => Number(limit.amount))
        .filter(amount => Number.isFinite(amount) && amount > 0)
        .reduce((best, amount) => Math.max(best, amount), 0)

      const outcomes: FeedOutcome[] = []
      let line: number | null = null

      for (const price of market.prices ?? []) {
        const side = SIDES[String(price.designation ?? '')]
        const decimal = fromAmericanNumber(Number(price.price))

        if (!side || decimal <= 1)
          continue

        const point = typeof price.points === 'number' ? price.points : null

        // Our convention: a spread's line is the home team's handicap.
        // Totals carry the same number on both sides.
        if (point !== null && (side === 'home' || side === 'over'))
          line = point

        outcomes.push({
          side,
          label: side === 'home' ? home : (side === 'away' ? away : side),
          point,
          price: decimal,
          ...(limitAmount > 0 ? { limitAmount } : {}),
        })
      }

      if (outcomes.length < 2)
        continue

      feedMarkets.push({
        marketType,
        line,
        period: periodName(market.period, sportSlug),
        outcomes,
      })
    }

    if (feedMarkets.length === 0)
      continue

    const book: FeedBook = {
      key: 'pinnacle',
      title: 'Pinnacle',
      lastUpdate: new Date().toISOString(),
      markets: feedMarkets,
    }

    events.push({ externalId, sportSlug, commenceAt, homeTeam: home, awayTeam: away, books: [book] })
  }

  return events
}

async function getJson<T>(url: string, ctx: BookContext, what: string): Promise<T | null> {
  const response = await ctx.fetch(url, { headers: HEADERS })
  if (!response)
    return null

  if (response.status === 304)
    return null

  if (!response.ok) {
    // A 403 here is usually not a blocked scraper but a blocked *country*:
    // Pinnacle refuses jurisdictions it is not licensed in, and says so in
    // the body. Reporting that as a bare "HTTP 403" sends whoever reads the
    // run row hunting for a header problem that does not exist, so the
    // reason is pulled out and named.
    if (response.status === 403) {
      const reason = await response.clone().json()
        .then((body: any) => String(body?.detail ?? body?.reason ?? ''))
        .catch(() => '')

      if (reason) {
        ctx.tracker.fail(
          `pinnacle: ${what} refused — ${reason}. `
          + 'Set ODDS_PROXY_PINNACLE to a host in a jurisdiction Pinnacle serves.',
        )
        return null
      }
    }

    ctx.tracker.fail(`pinnacle: ${what} HTTP ${response.status}`)
    return null
  }

  try {
    return await response.json() as T
  }
  catch {
    ctx.tracker.fail(`pinnacle: ${what} unparseable body`)
    return null
  }
}

export const pinnacle: BookAdapter = {
  slug: 'pinnacle',
  kind: 'sportsbook',
  transport: 'json',
  sports: Object.keys(LEAGUES),

  async fetchSport(sport: SportRow, ctx: BookContext): Promise<FeedEvent[]> {
    const leagueId = LEAGUES[sport.slug]
    if (!leagueId)
      return []

    // Fixtures and prices in parallel: they are independent reads and the
    // book's own token bucket already bounds how fast they leave.
    const [matchups, markets] = await Promise.all([
      getJson<PinMatchup[]>(`${BASE}/leagues/${leagueId}/matchups`, ctx, `${sport.slug} matchups`),
      getJson<PinMarket[]>(`${BASE}/leagues/${leagueId}/markets/straight`, ctx, `${sport.slug} markets`),
    ])

    // Either half missing means no usable prices. A matchup list with no
    // markets is a fixture list, and markets with no matchups cannot be
    // attached to anything.
    if (!Array.isArray(matchups) || !Array.isArray(markets))
      return []

    return translate(matchups, markets, sport.slug)
  },
}
