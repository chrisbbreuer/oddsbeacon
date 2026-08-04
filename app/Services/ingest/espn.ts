import type { Database } from 'bun:sqlite'
import type { SportRow } from './resolve'
import { nowIso, toIso } from '../../Support/keys'
import { loadSports, resolveEvent, resolveTeam } from './resolve'
import { fetchWithRetry, IngestRunTracker } from './run'

/**
 * ESPN as the schedule-and-results backbone.
 *
 * ESPN's site API needs no key, no account, and no quota, which makes it
 * the right source for the two things the system cannot function without:
 * **which games exist** and **how they finished**. Odds feeds are metered
 * and partial; a schedule is neither, and every paid request we spend
 * discovering fixtures is one not spent on prices.
 *
 * It is also what closes the loop that was previously open. Scores were
 * already fetched here for display and then discarded, so nothing was ever
 * graded and no claim about accuracy could be checked. Persisting results
 * is what turns the feature snapshots into a labelled training set instead
 * of a log.
 *
 * The API is undocumented and unstable by nature, so every read is
 * defensive: a shape change degrades to fewer events rather than a thrown
 * pass, and the run row records how many were skipped.
 */

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports'

interface EspnCompetitor {
  homeAway?: string
  score?: unknown
  winner?: boolean
  records?: Array<{ type?: string, summary?: string }>
  team?: {
    id?: string
    displayName?: string
    name?: string
    shortDisplayName?: string
    abbreviation?: string
    logo?: string
    logos?: Array<{ href?: string }>
  }
}

function num(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Map ESPN's state vocabulary onto ours.
 *
 * ESPN uses 'pre' | 'in' | 'post', but 'post' covers postponed and
 * cancelled games as well as finished ones — settling those as finals
 * would grade markets that should have been voided, so the detail text is
 * checked before a game is called final.
 */
function mapStatus(state: string, detail: string): string {
  const d = detail.toLowerCase()
  if (d.includes('postponed'))
    return 'postponed'
  if (d.includes('canceled') || d.includes('cancelled'))
    return 'cancelled'
  if (state === 'in')
    return 'live'
  if (state === 'post')
    return 'final'
  return 'scheduled'
}

/** ESPN's `YYYYMMDD` for a day offset from today. */
function espnDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
}

export interface EspnIngestResult {
  provider: string
  status: string
  eventsSeen: number
  eventsCreated: number
  resultsWritten: number
  leagues: number
  errors: string[]
}

/**
 * Pull the schedule and results for every active, sporting league.
 *
 * `daysAhead`/`daysBack` bound the sweep. Looking back matters as much as
 * forward: a game that finished after the last pass needs its result
 * recorded, and a single-day window would miss anything that ran late or
 * happened while the worker was down.
 */
export async function ingestEspn(
  db: Database,
  options: { daysAhead?: number, daysBack?: number } = {},
): Promise<EspnIngestResult> {
  const daysAhead = options.daysAhead ?? 3
  const daysBack = options.daysBack ?? 1

  const tracker = new IngestRunTracker(db, 'espn', 'schedule')
  tracker.start()

  const sports = loadSports(db).filter(s => s.espn_path && !s.non_sporting)

  let eventsSeen = 0
  let eventsCreated = 0
  let resultsWritten = 0

  for (const sport of sports) {
    for (let offset = -daysBack; offset <= daysAhead; offset++) {
      const url = `${SCOREBOARD}/${sport.espn_path}/scoreboard?dates=${espnDate(offset)}&limit=200`
      tracker.requestCount++

      const res = await fetchWithRetry(url, { timeoutMs: 10_000 })
      if (!res || !res.ok) {
        tracker.fail(`${sport.slug} ${offset >= 0 ? '+' : ''}${offset}d: ${res ? `HTTP ${res.status}` : 'network'}`)
        continue
      }

      let payload: any
      try {
        payload = await res.json()
      }
      catch {
        tracker.fail(`${sport.slug}: unparseable body`)
        continue
      }

      const events: any[] = Array.isArray(payload?.events) ? payload.events : []
      tracker.rowsRead += events.length

      for (const event of events) {
        const outcome = ingestOneEvent(db, sport, event)
        if (outcome === null) {
          tracker.unmatchedCount++
          continue
        }
        eventsSeen++
        tracker.rowsWritten++
        if (outcome.created)
          eventsCreated++
        if (outcome.resultWritten)
          resultsWritten++
      }
    }
  }

  const summary = `${sports.length} leagues · ${eventsSeen} events (${eventsCreated} new) · ${resultsWritten} results`
  const { status, errors } = tracker.finish(summary)

  return {
    provider: 'espn',
    status,
    eventsSeen,
    eventsCreated,
    resultsWritten,
    leagues: sports.length,
    errors,
  }
}

/**
 * Persist one scoreboard entry: teams, event, and — when it has finished —
 * the result.
 *
 * Returns null for anything unusable rather than throwing, so one odd row
 * cannot cost the rest of the league.
 */
function ingestOneEvent(
  db: Database,
  sport: SportRow,
  event: any,
): { created: boolean, resultWritten: boolean } | null {
  const externalId = String(event?.id ?? '')
  if (!externalId)
    return null

  const competition = event?.competitions?.[0]
  const competitors: EspnCompetitor[] = competition?.competitors ?? []
  if (competitors.length < 2)
    return null

  // ESPN does not guarantee ordering, so pick by side rather than index.
  const homeRaw = competitors.find(c => c?.homeAway === 'home') ?? competitors[0]
  const awayRaw = competitors.find(c => c?.homeAway === 'away') ?? competitors[1]
  if (!homeRaw || !awayRaw)
    return null

  const homeName = String(homeRaw.team?.displayName ?? homeRaw.team?.name ?? '')
  const awayName = String(awayRaw.team?.displayName ?? awayRaw.team?.name ?? '')
  if (!homeName || !awayName)
    return null

  const homeTeamId = resolveTeam(db, sport.id, homeName, {
    shortName: homeRaw.team?.shortDisplayName,
    abbreviation: homeRaw.team?.abbreviation,
    logo: homeRaw.team?.logo ?? homeRaw.team?.logos?.[0]?.href,
    espnId: homeRaw.team?.id,
    record: homeRaw.records?.find(r => r?.type === 'total')?.summary ?? homeRaw.records?.[0]?.summary,
  })
  const awayTeamId = resolveTeam(db, sport.id, awayName, {
    shortName: awayRaw.team?.shortDisplayName,
    abbreviation: awayRaw.team?.abbreviation,
    logo: awayRaw.team?.logo ?? awayRaw.team?.logos?.[0]?.href,
    espnId: awayRaw.team?.id,
    record: awayRaw.records?.find(r => r?.type === 'total')?.summary ?? awayRaw.records?.[0]?.summary,
  })

  const commenceAt = toIso(event?.date)
  if (!commenceAt)
    return null

  const statusBlock = event?.status ?? competition?.status ?? {}
  const type = statusBlock?.type ?? {}
  const detail = String(type?.shortDetail ?? type?.description ?? '')
  const status = mapStatus(String(type?.state ?? 'pre'), detail)

  const { eventId, created } = resolveEvent(db, {
    sportId: sport.id,
    provider: 'espn',
    externalId,
    // ESPN orders its own titles away-at-home; ours reads the same way so
    // the board and the scoreboard agree at a glance.
    title: `${awayName} at ${homeName}`,
    commenceAt,
    homeTeamId,
    awayTeamId,
    category: sport.grouping,
    league: sport.title,
    venue: competition?.venue?.fullName ?? '',
    broadcast: competition?.broadcasts?.[0]?.names?.[0] ?? '',
  })

  db.prepare('UPDATE market_events SET status = ?, status_detail = ?, last_seen_at = ?, updated_at = ? WHERE id = ?')
    .run(status, status === 'live' ? String(statusBlock?.displayClock ?? detail) : detail, nowIso(), nowIso(), eventId)

  let resultWritten = false
  if (status === 'final') {
    const homeScore = num(homeRaw.score)
    const awayScore = num(awayRaw.score)
    if (homeScore !== null && awayScore !== null) {
      writeResult(db, eventId, homeScore, awayScore, competition)
      resultWritten = true
    }
  }

  return { created, resultWritten }
}

/**
 * Record the final score.
 *
 * Upserts rather than inserts because a game can be re-reported — ESPN
 * corrects scores, and a stat correction hours later should update the
 * grade rather than fail on a duplicate key.
 *
 * `graded_at` is deliberately left empty: writing the result and grading
 * the markets against it are separate passes, so a correction here
 * re-opens grading automatically.
 */
function writeResult(
  db: Database,
  eventId: number,
  homeScore: number,
  awayScore: number,
  competition: any,
): void {
  const winnerSide = homeScore > awayScore ? 'home' : (awayScore > homeScore ? 'away' : 'draw')

  const periodScores = JSON.stringify({
    home: (competition?.competitors ?? []).find((c: any) => c?.homeAway === 'home')?.linescores?.map((l: any) => num(l?.value) ?? 0) ?? [],
    away: (competition?.competitors ?? []).find((c: any) => c?.homeAway === 'away')?.linescores?.map((l: any) => num(l?.value) ?? 0) ?? [],
  })

  db.prepare(`
    INSERT INTO event_results
      (market_event_id, home_score, away_score, winner_side, period_scores, completed, source, settled_at, graded_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 'espn', ?, '', ?, ?)
    ON CONFLICT (market_event_id) DO UPDATE SET
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      winner_side = excluded.winner_side,
      period_scores = excluded.period_scores,
      settled_at = excluded.settled_at,
      graded_at = CASE
        WHEN event_results.home_score != excluded.home_score
          OR event_results.away_score != excluded.away_score
        THEN ''
        ELSE event_results.graded_at
      END,
      updated_at = excluded.updated_at
  `).run(eventId, homeScore, awayScore, winnerSide, periodScores, nowIso(), nowIso(), nowIso())
}
