import type { SportRow } from '../ingest/resolve'
import type { IngestRunTracker } from '../ingest/run'
import type { FeedBook, FeedEvent, FeedMarket, FeedOutcome, OddsProvider } from './provider'
import { norm, toIso } from '../../Support/keys'
import { fetchWithRetry } from '../ingest/run'

/**
 * The Odds API (the-odds-api.com) — the paid price feed.
 *
 * ### What changed and why
 * The previous implementation could not work. It matched incoming outcomes
 * to stored rows through a single global map of normalized selection
 * *labels*, so prices for one game could land on another, and full names
 * from the feed ("Los Angeles Lakers") never matched short stored labels
 * ("Lakers") at all. It also silently swallowed every error and returned
 * an empty list, so a feed matching nothing looked exactly like a quiet
 * market.
 *
 * This version does no matching of its own. It translates the feed into
 * the shared {@link FeedEvent} shape — carrying the provider's event id,
 * which is stable — and hands identity resolution to
 * `app/Services/ingest/resolve.ts`, which links once and joins on ids
 * thereafter. Failures are reported to the run tracker rather than
 * swallowed.
 *
 * ### Quota
 * The free tier is 500 requests a month and each region-and-market
 * combination is billed separately, so requests are batched per sport
 * across all regions and markets in one call — the API supports this, and
 * doing otherwise multiplies the bill by roughly fifteen for identical
 * data.
 */

const BASE = 'https://api.the-odds-api.com/v4'

/** Bet types we request. Ordered by how much they are actually used. */
const MARKETS = ['h2h', 'spreads', 'totals'] as const

/**
 * Regions to pull.
 *
 * More regions means more books and a better consensus, and — importantly
 * — costs nothing extra beyond the single per-request charge, because the
 * API bills per request rather than per book returned.
 */
const REGIONS = 'us,us2,uk,eu,au'

interface ApiOutcome {
  name?: string
  price?: number
  point?: number
  description?: string
}

interface ApiMarket {
  key?: string
  last_update?: string
  outcomes?: ApiOutcome[]
}

interface ApiBookmaker {
  key?: string
  title?: string
  last_update?: string
  markets?: ApiMarket[]
}

interface ApiEvent {
  id?: string
  sport_key?: string
  commence_time?: string
  home_team?: string
  away_team?: string
  bookmakers?: ApiBookmaker[]
}

export class TheOddsApiProvider implements OddsProvider {
  readonly name = 'the-odds-api'

  constructor(
    private readonly apiKey: string,
    private readonly sports: SportRow[],
  ) {}

  async fetchEvents(tracker: IngestRunTracker): Promise<FeedEvent[]> {
    const out: FeedEvent[] = []

    for (const sport of this.sports) {
      if (!sport.odds_api_key)
        continue

      const url = `${BASE}/sports/${sport.odds_api_key}/odds`
        + `?apiKey=${encodeURIComponent(this.apiKey)}`
        + `&regions=${REGIONS}`
        + `&markets=${MARKETS.join(',')}`
        + `&oddsFormat=decimal`

      tracker.requestCount++
      const res = await fetchWithRetry(url, { timeoutMs: 15_000 })

      if (!res) {
        tracker.fail(`${sport.slug}: network failure`)
        continue
      }

      // Read the budget before anything else — a 401 or 422 still carries
      // the headers, and knowing the quota is exhausted is the single most
      // useful fact when the board goes stale.
      tracker.readQuota(res.headers)

      if (!res.ok) {
        tracker.fail(`${sport.slug}: HTTP ${res.status}`)
        continue
      }

      let payload: ApiEvent[]
      try {
        payload = await res.json() as ApiEvent[]
      }
      catch {
        tracker.fail(`${sport.slug}: unparseable body`)
        continue
      }

      if (!Array.isArray(payload))
        continue

      for (const event of payload) {
        const translated = translateEvent(event, sport.slug)
        if (translated)
          out.push(translated)
      }
    }

    return out
  }
}

/** Translate one API event, or null when it is unusable. */
function translateEvent(event: ApiEvent, sportSlug: string): FeedEvent | null {
  const externalId = String(event.id ?? '')
  const homeTeam = String(event.home_team ?? '')
  const awayTeam = String(event.away_team ?? '')
  const commenceAt = toIso(event.commence_time)

  if (!externalId || !homeTeam || !awayTeam || !commenceAt)
    return null

  const books: FeedBook[] = []
  for (const book of event.bookmakers ?? []) {
    const key = String(book.key ?? '')
    if (!key)
      continue

    const markets: FeedMarket[] = []
    for (const market of book.markets ?? []) {
      const translatedMarket = translateMarket(market, homeTeam, awayTeam)
      if (translatedMarket)
        markets.push(translatedMarket)
    }

    if (markets.length > 0) {
      books.push({
        key,
        title: String(book.title ?? key),
        lastUpdate: toIso(book.last_update),
        markets,
      })
    }
  }

  if (books.length === 0)
    return null

  return { externalId, sportSlug, commenceAt, homeTeam, awayTeam, books }
}

/**
 * Translate one bet type, mapping outcome names to our closed `side`
 * vocabulary.
 *
 * Team names are matched normalized because the feed is inconsistent about
 * punctuation and spacing between markets on the same event. An outcome
 * that matches neither team and is not a recognized keyword is dropped
 * rather than guessed at — a mis-sided price grades backwards, which is
 * worse than a missing one.
 */
function translateMarket(market: ApiMarket, homeTeam: string, awayTeam: string): FeedMarket | null {
  const key = String(market.key ?? '')
  if (!MARKETS.includes(key as typeof MARKETS[number]))
    return null

  const home = norm(homeTeam)
  const away = norm(awayTeam)

  const outcomes: FeedOutcome[] = []
  let homePoint: number | null = null

  for (const outcome of market.outcomes ?? []) {
    const name = String(outcome.name ?? '')
    const price = Number(outcome.price)
    if (!name || !Number.isFinite(price) || price <= 1)
      continue

    const point = Number.isFinite(outcome.point as number) ? Number(outcome.point) : null
    const normalized = norm(name)

    let side: string | null = null
    if (key === 'totals') {
      if (normalized === 'over')
        side = 'over'
      else if (normalized === 'under')
        side = 'under'
    }
    else {
      if (normalized === home)
        side = 'home'
      else if (normalized === away)
        side = 'away'
      else if (normalized === 'draw' || normalized === 'tie')
        side = 'draw'
    }

    if (side === null)
      continue

    if (side === 'home')
      homePoint = point

    outcomes.push({ side, label: name, point, price })
  }

  if (outcomes.length === 0)
    return null

  // The market's line: the total for totals, the home handicap for
  // spreads, nothing for a moneyline. Deriving it from the home side keeps
  // one convention across every book, so two books on the same spread
  // resolve to the same market instead of a mirrored pair of them.
  let line: number | null = null
  if (key === 'totals')
    line = outcomes.find(o => o.side === 'over')?.point ?? outcomes[0]?.point ?? null
  else if (key === 'spreads')
    line = homePoint ?? (outcomes.find(o => o.side === 'away')?.point ?? null)

  return {
    marketType: key,
    line,
    period: 'full_game',
    outcomes,
  }
}
