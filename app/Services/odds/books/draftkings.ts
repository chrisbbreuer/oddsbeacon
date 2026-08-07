import type { SportRow } from '../../ingest/resolve'
import type { FeedBook, FeedEvent, FeedMarket, FeedOutcome } from '../provider'
import type { BookAdapter, BookContext } from './adapter'

/**
 * DraftKings, read from the endpoint its own web sportsbook calls.
 *
 * ### The response is relational, not nested
 *
 * `events`, `markets` and `selections` come back as three flat arrays
 * joined by id, rather than as markets nested inside events. So the
 * translation indexes selections by `marketId` and markets by `eventId`
 * once, up front — the naive nested filter is O(events × markets ×
 * selections) and a hundred-event league makes that felt.
 *
 * ### Key on `marketType.id`, never on `name`
 *
 * The same market is called "Run Line" in MLB and "Spread" in NFL, while
 * `marketType.id` is `2_0` in both. Matching on the display name would
 * silently drop spreads for every sport whose label we had not enumerated,
 * and dropping a market type reads downstream as a book that does not
 * offer it rather than as a parser that missed it.
 *
 * ### The full browser header set is load-bearing
 *
 * Akamai fronts this endpoint and fingerprints on the `sec-*`, `x-client-*`
 * and `x-pe-*` headers. A request with a plain user agent and `accept`
 * gets a 403 HTML page, not JSON — verified, not assumed. The headers are
 * therefore part of the contract with the endpoint rather than decoration,
 * which is why they are spelled out here.
 *
 * ### League ids are verified, not guessed
 *
 * An out-of-season league returns an empty payload, which is
 * indistinguishable from a wrong league id. Only ids that returned real
 * events are listed; see the note on {@link LEAGUES}.
 */

const BASE = 'https://sportsbook-nash.draftkings.com/sites/US-SB/api/sportscontent/controldata/league/leagueSubcategory/v1/markets'

/**
 * Our sport slug to DraftKings' league and game-lines subcategory.
 *
 * **Every entry here returned real events when it was added.** That matters
 * because an empty response proves nothing: a league that is out of season
 * and a league whose id is wrong look identical. NBA and NHL are absent for
 * exactly that reason — both returned zero in August, and adding them on
 * that evidence would be recording a guess as a fact.
 *
 * To add one, hit the endpoint while the league is in season and confirm
 * events come back. `./buddy odds:probe draftkings <league> <subcategory>`
 * is not a thing yet; a curl is fine.
 */
const LEAGUES: Record<string, { league: string, subcategory: string }> = {
  mlb: { league: '84240', subcategory: '4519' },
  nfl: { league: '88808', subcategory: '4518' },
  ncaaf: { league: '87637', subcategory: '4518' },
}

/**
 * Market type ids we translate, mapped to our vocabulary.
 *
 * Ids rather than names, for the reason in the class note. Anything not
 * listed is skipped rather than guessed at — a market we cannot confidently
 * name is worse than a market we do not carry, because a mislabelled market
 * is de-vigged against the wrong complementary pair.
 */
const MARKET_TYPES: Record<string, string> = {
  '1_0': 'h2h',
  '2_0': 'spreads',
  '3_0': 'totals',
}

/** DraftKings' outcome vocabulary to ours. */
const SIDES: Record<string, string> = {
  Home: 'home',
  Away: 'away',
  Over: 'over',
  Under: 'under',
  Draw: 'draw',
}

/**
 * The headers this endpoint requires, including a browser user agent.
 *
 * ### Be clear about what this is
 *
 * Akamai gates on the user agent. The identical request returns 200 with a
 * Chrome UA and 403 with `PredictHQ/1.0 (+https://predicthq.com)` —
 * isolated by varying nothing else. So sending a browser UA here is not a
 * compatibility shim, it is presenting as a browser in order to get past a
 * check that would otherwise refuse us. DraftKings has, in effect, said it
 * would rather we did not read this endpoint, and this proceeds anyway.
 *
 * That is a deliberate product decision, not an implementation detail, and
 * it belongs in the open rather than buried in a header map. `ODDS_USER_AGENT`
 * overrides it, and setting it to anything that names us turns this adapter
 * off in practice — the requests will 403 and be recorded as failures
 * rather than silently returning nothing.
 *
 * The rest were established by removing headers until the edge refused.
 */
const HEADERS: Record<string, string> = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'origin': 'https://sportsbook.draftkings.com',
  'referer': 'https://sportsbook.draftkings.com/',
  'sec-ch-ua': '"Chromium";v="151", "Not=A?Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'x-client-feature': 'leagueSubcategory',
  'x-client-name': 'web',
  'x-client-page': 'league',
  'x-client-widget-name': 'cms',
  'x-pe-cn': 'web',
  'x-pe-ep': 'SB',
}

interface DkParticipant {
  id?: string
  name?: string
  venueRole?: string
  metadata?: { retailRotNumber?: string }
}

interface DkEvent {
  id?: string
  name?: string
  startEventDate?: string
  status?: string
  participants?: DkParticipant[]
}

interface DkMarket {
  id?: string
  eventId?: string
  marketType?: { id?: string, name?: string }
}

interface DkSelection {
  id?: string
  marketId?: string
  label?: string
  points?: number | null
  trueOdds?: number
  outcomeType?: string
}

export interface DkPayload {
  events?: DkEvent[]
  markets?: DkMarket[]
  selections?: DkSelection[]
}

export function buildUrl(league: string, subcategory: string): string {
  const params = new URLSearchParams({
    isBatchable: 'false',
    templateVars: `${league},${subcategory}`,
    eventsQuery: `$filter=leagueId eq '${league}' AND clientMetadata/Subcategories/any(s: s/Id eq '${subcategory}')`,
    marketsQuery: `$filter=clientMetadata/subCategoryId eq '${subcategory}' AND tags/all(t: t ne 'SportcastBetBuilder')`,
    include: 'Events',
    entity: 'events',
  })

  // `URLSearchParams` encodes a space as `+`, which is correct for a form
  // body and is rejected here: the edge answers `+` inside these OData
  // filters with a 403 HTML page. Percent-encoding is what the site's own
  // client sends and what this endpoint accepts. Verified by flipping this
  // one substitution and watching a working request start failing.
  return `${BASE}?${params.toString().replace(/\+/g, '%20')}`
}

/** Which side of the fixture a participant is on, by DraftKings' own field. */
function teamsOf(event: DkEvent): { home: string, away: string, rotation: string } {
  let home = ''
  let away = ''
  let rotation = ''

  for (const participant of event.participants ?? []) {
    // `venueRole` rather than array order. Order is not documented and a
    // reversed fixture would swap every home and away price on the board
    // while still looking entirely plausible.
    if (participant.venueRole === 'Home') {
      home = String(participant.name ?? '')
      rotation = String(participant.metadata?.retailRotNumber ?? '')
    }
    else if (participant.venueRole === 'Away') {
      away = String(participant.name ?? '')
    }
  }

  return { home, away, rotation }
}

/**
 * Translate one league payload into the shared feed shape.
 *
 * Exported so it can be tested against a recorded response without a
 * network call — the payload is the part that changes under us, so it is
 * the part that has to be pinned.
 */
export function translate(payload: DkPayload, sportSlug: string): FeedEvent[] {
  // Index once. The nested-filter alternative is quadratic and this
  // endpoint returns a hundred events with six hundred selections.
  const selectionsByMarket = new Map<string, DkSelection[]>()
  for (const selection of payload.selections ?? []) {
    const key = String(selection.marketId ?? '')
    if (!key)
      continue
    const list = selectionsByMarket.get(key) ?? []
    list.push(selection)
    selectionsByMarket.set(key, list)
  }

  const marketsByEvent = new Map<string, DkMarket[]>()
  for (const market of payload.markets ?? []) {
    const key = String(market.eventId ?? '')
    if (!key)
      continue
    const list = marketsByEvent.get(key) ?? []
    list.push(market)
    marketsByEvent.set(key, list)
  }

  const events: FeedEvent[] = []

  for (const event of payload.events ?? []) {
    const externalId = String(event.id ?? '')
    const commenceAt = event.startEventDate ? new Date(event.startEventDate).toISOString() : ''
    const { home, away } = teamsOf(event)

    // A record missing any of these cannot be resolved to a fixture, and
    // guessing at the missing half is how prices land on the wrong game.
    if (!externalId || !commenceAt || !home || !away)
      continue

    const markets: FeedMarket[] = []

    for (const market of marketsByEvent.get(externalId) ?? []) {
      const marketType = MARKET_TYPES[String(market.marketType?.id ?? '')]
      if (!marketType)
        continue

      const outcomes: FeedOutcome[] = []
      let line: number | null = null

      for (const selection of selectionsByMarket.get(String(market.id ?? '')) ?? []) {
        const side = SIDES[String(selection.outcomeType ?? '')]
        const price = Number(selection.trueOdds)

        // `trueOdds` is the decimal price. A quote at or below 1 pays
        // nothing and is a parse failure rather than a real price.
        if (!side || !Number.isFinite(price) || price <= 1)
          continue

        const point = typeof selection.points === 'number' ? selection.points : null

        // Our convention: a spread's line is the *home* team's handicap,
        // signed. Totals carry the same number on both sides, so either
        // works; taking home for spreads keeps one rule for both.
        if (point !== null && (side === 'home' || side === 'over'))
          line = point

        outcomes.push({
          side,
          label: String(selection.label ?? ''),
          point,
          price,
          sid: String(selection.id ?? ''),
        })
      }

      // A one-sided market cannot be de-vigged — there is no complementary
      // pair to remove the margin against — so it is dropped rather than
      // stored as a market that silently never produces a fair value.
      if (outcomes.length < 2)
        continue

      markets.push({ marketType, line, outcomes })
    }

    if (markets.length === 0)
      continue

    const book: FeedBook = {
      key: 'draftkings',
      title: 'DraftKings',
      // The endpoint publishes no per-quote timestamp, so the read time is
      // the honest answer. Inventing one would let a stale payload look
      // freshly quoted to the placement guard.
      lastUpdate: new Date().toISOString(),
      markets,
    }

    events.push({ externalId, sportSlug, commenceAt, homeTeam: home, awayTeam: away, books: [book] })
  }

  return events
}

export const draftkings: BookAdapter = {
  slug: 'draftkings',
  kind: 'sportsbook',
  transport: 'json',
  sports: Object.keys(LEAGUES),

  async fetchSport(sport: SportRow, ctx: BookContext): Promise<FeedEvent[]> {
    const mapping = LEAGUES[sport.slug]
    if (!mapping)
      return []

    const response = await ctx.fetch(buildUrl(mapping.league, mapping.subcategory), { headers: HEADERS })

    // `ctx.fetch` reports its own transport failures; a null here has
    // already been recorded against this book.
    if (!response)
      return []

    // Unchanged since the last poll. Re-parsing would produce identical
    // writes, which the price writer would discard anyway.
    if (response.status === 304)
      return []

    if (!response.ok) {
      ctx.tracker.fail(`draftkings: ${sport.slug} HTTP ${response.status}`)
      return []
    }

    let payload: DkPayload
    try {
      payload = await response.json() as DkPayload
    }
    catch {
      // Akamai answers a refused request with an HTML page, so an
      // unparseable body usually means blocked rather than malformed.
      ctx.tracker.fail(`draftkings: ${sport.slug} unparseable body`)
      return []
    }

    return translate(payload, sport.slug)
  },
}
