/**
 * ESPN scoreboard client.
 *
 * ESPN's site API is public but undocumented: no key, no rate-limit
 * headers, no stability guarantee. That is the trade we accepted to get
 * live scores today, and it shapes the code. Every read is defensive,
 * every field optional, and a shape change degrades to fewer games rather
 * than a stack trace on the page.
 *
 * Swapping to a paid feed later means reimplementing `fetchScoreboard`
 * and nothing else, which is why the normalised types below are ours
 * rather than ESPN's.
 */

export interface Team {
  abbreviation: string
  name: string
  shortName: string
  logo: string | null
  score: number | null
  record: string | null
  winner: boolean
}

export interface Game {
  id: string
  league: string
  startsAt: string
  /** 'pre' | 'in' | 'post' — ESPN's own state vocabulary, kept as-is. */
  state: string
  /** "Final", "2nd Quarter", "Scheduled". */
  status: string
  /** "7:32 - 2nd" while live, empty otherwise. */
  clock: string
  venue: string | null
  broadcast: string | null
  home: Team
  away: Team
}

export interface League {
  key: string
  label: string
  /** ESPN's `{sport}/{league}` path segment. */
  path: string
}

/**
 * The leagues offered in the switcher.
 *
 * Deliberately short. Every entry is a live network call, and a switcher
 * with thirty options is a menu rather than a product decision.
 */
export const LEAGUES: League[] = [
  { key: 'nfl', label: 'NFL', path: 'football/nfl' },
  { key: 'nba', label: 'NBA', path: 'basketball/nba' },
  { key: 'mlb', label: 'MLB', path: 'baseball/mlb' },
  { key: 'nhl', label: 'NHL', path: 'hockey/nhl' },
  { key: 'epl', label: 'Premier League', path: 'soccer/eng.1' },
  { key: 'atp', label: 'Tennis', path: 'tennis/atp' },
]

export function leagueFor(key: string): League {
  return LEAGUES.find(l => l.key === key) ?? LEAGUES[0]!
}

function num(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toTeam(competitor: any): Team {
  const team = competitor?.team ?? {}
  return {
    abbreviation: String(team.abbreviation ?? '').slice(0, 5),
    name: String(team.displayName ?? team.name ?? 'Unknown'),
    shortName: String(team.shortDisplayName ?? team.abbreviation ?? ''),
    logo: typeof team.logo === 'string' ? team.logo : null,
    score: num(competitor?.score),
    // ESPN nests the summary record among several; the overall one is the
    // only one worth a line on a scoreboard.
    record: competitor?.records?.find((r: any) => r?.type === 'total')?.summary
      ?? competitor?.records?.[0]?.summary
      ?? null,
    winner: competitor?.winner === true,
  }
}

/**
 * One league's games for a given day.
 *
 * `date` is ESPN's `YYYYMMDD`. Omitted means today in ESPN's own timezone,
 * which is what their site shows and therefore what a user comparing the
 * two expects.
 */
export async function fetchScoreboard(leagueKey: string, date?: string): Promise<Game[]> {
  const league = leagueFor(leagueKey)
  const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/${league.path}/scoreboard`)
  if (date)
    url.searchParams.set('dates', date)

  let payload: any
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      // A scoreboard that has not answered in eight seconds is not a
      // scoreboard worth blocking a page render on.
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok)
      return []
    payload = await res.json()
  }
  catch {
    // Network failure, timeout, or unparseable body. The page renders its
    // empty state; an undocumented upstream going quiet is not an outage
    // worth failing the request over.
    return []
  }

  const events: any[] = Array.isArray(payload?.events) ? payload.events : []

  return events.flatMap((event) => {
    const competition = event?.competitions?.[0]
    const competitors: any[] = competition?.competitors ?? []
    if (competitors.length < 2)
      return []

    // ESPN does not guarantee ordering, so pick by side rather than index.
    const homeRaw = competitors.find(c => c?.homeAway === 'home') ?? competitors[0]
    const awayRaw = competitors.find(c => c?.homeAway === 'away') ?? competitors[1]
    const status = event?.status ?? competition?.status ?? {}
    const type = status?.type ?? {}

    return [{
      id: String(event?.id ?? ''),
      league: league.key,
      startsAt: String(event?.date ?? ''),
      state: String(type?.state ?? 'pre'),
      status: String(type?.shortDetail ?? type?.description ?? ''),
      // Only meaningful in-play; ESPN leaves stale values on finished games.
      clock: type?.state === 'in' ? String(status?.displayClock ?? '') : '',
      venue: competition?.venue?.fullName ?? null,
      broadcast: competition?.broadcasts?.[0]?.names?.[0] ?? null,
      home: toTeam(homeRaw),
      away: toTeam(awayRaw),
    }]
  })
}
