import type { Database } from 'bun:sqlite'
import process from 'node:process'
import { loadSports, resolveTeam } from '../ingest/resolve'
import { fetchWithRetry, IngestRunTracker } from '../ingest/run'

/**
 * Squad valuations from Transfermarkt's licensed API.
 *
 * The API, deliberately, and not the website: transfermarkt.com publishes
 * a robots.txt that disallows automated agents outright, so the site is
 * not a source this system reads. A licensed API key is a different thing
 * entirely, and it is the only path here.
 *
 * What this buys is the one input that can disagree with a bookmaker
 * rather than average it. Every other number this system prices with is
 * derived from book quotes, so a mispriced fixture stays mispriced no
 * matter how carefully it is de-vigged. Kalshi lists cup ties and
 * friendlies pairing a first-division side against a fourth-division one
 * (`KXEFLCUPGAME` alone is full of them), and squad value plus league
 * tier is what tells those apart.
 *
 * Absent credentials this reports `skipped` rather than failing. The
 * pipeline runs every five minutes on installs that will never configure
 * it, and a provider that cannot run is not the same as one that broke.
 */

const BASE = process.env.TRANSFERMARKT_API_URL || 'https://api.transfermarkt.com'

export interface ValuationResult {
  provider: string
  status: string
  clubsWritten: number
  competitions: number
  unmatched: number
  errors: string[]
}

/** The soccer competitions worth valuing, by our sport slug. */
interface CompetitionTarget {
  sportSlug: string
  /** Provider's competition id. */
  externalId: string
  /** 1 = top flight of its country. */
  tier: number
  label: string
}

/**
 * Deliberately explicit rather than discovered. Tier is the field doing
 * most of the work in a mismatch, and inferring it from a name is exactly
 * the kind of guess that quietly mislabels a second division as a first.
 */
const COMPETITIONS: CompetitionTarget[] = [
  { sportSlug: 'epl', externalId: 'GB1', tier: 1, label: 'Premier League' },
  { sportSlug: 'laliga', externalId: 'ES1', tier: 1, label: 'LaLiga' },
  { sportSlug: 'seriea', externalId: 'IT1', tier: 1, label: 'Serie A' },
  { sportSlug: 'bundesliga', externalId: 'L1', tier: 1, label: 'Bundesliga' },
  { sportSlug: 'ucl', externalId: 'CL', tier: 1, label: 'Champions League' },
]

export function transfermarktConfigured(): boolean {
  return Boolean(process.env.TRANSFERMARKT_API_KEY)
}

/** Parse '€1.20bn' / '450.00m' / '900k' into whole euros. */
export function parseMarketValue(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw))
    return Math.max(0, Math.round(raw))

  const text = String(raw ?? '').trim().toLowerCase().replace(/[€,\s]/g, '')
  if (!text)
    return 0

  const match = text.match(/^([\d.]+)(bn|m|k)?$/)
  if (!match)
    return 0

  const amount = Number(match[1])
  if (!Number.isFinite(amount))
    return 0

  const scale = match[2] === 'bn' ? 1e9 : match[2] === 'm' ? 1e6 : match[2] === 'k' ? 1e3 : 1
  return Math.round(amount * scale)
}

export async function ingestClubValuations(db: Database): Promise<ValuationResult> {
  const tracker = new IngestRunTracker(db, 'transfermarkt', 'valuations')
  tracker.start()

  const key = process.env.TRANSFERMARKT_API_KEY
  if (!key) {
    // Not an error. Recorded so `/pipeline` can say the provider is off
    // rather than leaving a gap that reads as a failed run.
    tracker.finish('skipped: TRANSFERMARKT_API_KEY is not set')
    return {
      provider: 'transfermarkt',
      status: 'skipped',
      clubsWritten: 0,
      competitions: 0,
      unmatched: 0,
      errors: [],
    }
  }

  const sportIds = new Map(loadSports(db).map(s => [s.slug, s.id]))
  const capturedAt = new Date().toISOString()

  const insert = db.prepare(`
    INSERT INTO club_valuations
      (sports_team_id, squad_value_eur, squad_size, average_age_years, league_tier,
       competition, source, external_id, captured_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'transfermarkt', ?, ?, ?, ?)
  `)

  let clubsWritten = 0
  let competitions = 0

  for (const target of COMPETITIONS) {
    const sportId = sportIds.get(target.sportSlug)
    if (!sportId)
      continue

    const res = await fetchWithRetry(`${BASE}/competitions/${target.externalId}/clubs`, {
      headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' },
    })
    tracker.requestCount++

    if (!res) {
      tracker.fail(`${target.label}: unreachable`)
      continue
    }

    try {
      const payload = await res.json() as any
      const clubs = payload?.clubs ?? payload?.data ?? []

      db.run('BEGIN')
      try {
        for (const club of clubs) {
          tracker.rowsRead++
          const name = String(club?.name ?? club?.clubName ?? '').trim()
          const teamId = name ? resolveTeam(db, sportId, name) : null

          if (!teamId) {
            tracker.unmatchedCount++
            continue
          }

          insert.run(
            teamId,
            parseMarketValue(club?.marketValue ?? club?.totalMarketValue),
            Number(club?.squad?.size ?? club?.squadSize ?? 0) || 0,
            Number(club?.squad?.averageAge ?? club?.averageAge ?? 0) || 0,
            target.tier,
            target.label,
            String(club?.id ?? '').slice(0, 80),
            capturedAt,
            capturedAt,
            capturedAt,
          )
          clubsWritten++
          tracker.rowsWritten++
        }
        db.run('COMMIT')
      }
      catch (err) {
        try {
          db.run('ROLLBACK')
        }
        catch { /* the original error is the useful one */ }
        throw err
      }

      competitions++
    }
    catch (err) {
      tracker.fail(`${target.label}: ${(err as Error).message}`)
    }
  }

  const { status, errors } = tracker.finish(`${competitions} competitions · ${clubsWritten} clubs`)

  return {
    provider: 'transfermarkt',
    status,
    clubsWritten,
    competitions,
    unmatched: tracker.unmatchedCount,
    errors,
  }
}
