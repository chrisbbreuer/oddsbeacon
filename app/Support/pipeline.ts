import type { Database } from 'bun:sqlite'
import process from 'node:process'
import { openRead } from './db'

/**
 * The two questions worth asking before trusting a number on this site.
 *
 * Is the price real, and has the model ever been right? Both are cheap to
 * answer and neither was answerable from any page: `/api/v1/status` knew
 * the provider had fallen back to the simulator and `/api/v1/calibration`
 * knew the sample size was zero, but a visitor reading an edge off the
 * board saw the same confident percentage either way.
 *
 * A simulated edge that looks live is the failure this is here to prevent.
 */

export interface FeedState {
  /** True when prices come from a real book feed rather than the simulator. */
  live: boolean
  /** The provider that actually wrote the last odds run. */
  provider: string
  lastRunAt: string | null
  ageSeconds: number | null
  /** True when the last run is old enough that the board may be wrong. */
  stale: boolean
  error: string | null
}

export interface TrackRecord {
  /** Settled predictions the score is built from. Zero means no record. */
  sampleSize: number
  brierScore: number
  logLoss: number
  avgClvPct: number
  computedAt: string | null
  /** Predictions made but not yet settled, and when the first one can be. */
  pendingPredictions: number
  nextSettlementAt: string | null
}

/** Odds older than this and the board is reporting the past as the present. */
const STALE_AFTER_SECONDS = 15 * 60

export function loadFeedState(db: Database = openRead()): FeedState {
  const run = db.query(`
    SELECT provider, status, finished_at, error
    FROM ingest_runs
    WHERE kind = 'odds'
    ORDER BY id DESC
    LIMIT 1
  `).get() as { provider: string, status: string, finished_at: string | null, error: string | null } | null

  if (!run) {
    return { live: false, provider: 'none', lastRunAt: null, ageSeconds: null, stale: true, error: null }
  }

  const lastRunAt = run.finished_at
  const ageSeconds = lastRunAt ? Math.max(0, Math.round((Date.now() - Date.parse(lastRunAt)) / 1000)) : null

  return {
    // Named rather than inferred from the env var: what matters is the
    // provider that wrote the rows on screen, not the one configured since.
    live: run.provider !== 'synthetic',
    provider: run.provider,
    lastRunAt,
    ageSeconds,
    stale: ageSeconds === null || ageSeconds > STALE_AFTER_SECONDS,
    error: run.error,
  }
}

export function loadTrackRecord(db: Database = openRead()): TrackRecord {
  const overall = db.query(`
    SELECT sample_size, brier_score, log_loss, avg_clv_pct, computed_at
    FROM calibration_buckets
    WHERE scope = 'overall'
    ORDER BY id DESC
    LIMIT 1
  `).get() as Record<string, any> | null

  // What has been predicted but cannot be scored yet, so an empty record
  // reads as "too early" rather than "nothing here".
  // commence_at, not starts_at: the latter exists on the table but is
  // never populated by the ESPN ingest, so keying off it reports "no
  // upcoming games" on a board full of them.
  const pending = db.query(`
    SELECT COUNT(DISTINCT m.market_event_id) AS events,
           MIN(e.commence_at) AS next
    FROM fair_prices fp
    JOIN selections s ON s.id = fp.selection_id
    JOIN markets m ON m.id = s.market_id
    JOIN market_events e ON e.id = m.market_event_id
    LEFT JOIN event_results r ON r.market_event_id = e.id AND r.completed = 1
    WHERE r.id IS NULL
  `).get() as { events: number, next: string | null }

  return {
    sampleSize: Number(overall?.sample_size ?? 0),
    brierScore: Number(overall?.brier_score ?? 0),
    logLoss: Number(overall?.log_loss ?? 0),
    avgClvPct: Number(overall?.avg_clv_pct ?? 0),
    computedAt: overall?.computed_at ?? null,
    pendingPredictions: Number(pending?.events ?? 0),
    nextSettlementAt: pending?.next ?? null,
  }
}

export interface FundamentalsCoverage {
  /** Teams with a standings row, and how many teams exist at all. */
  teamsWithStanding: number
  teamsTotal: number
  injuriesTracked: number
  clubsValued: number
  lastCapturedAt: string | null
}

/**
 * How much non-market evidence the model actually has.
 *
 * Worth its own read because the number that matters is coverage, not
 * volume: a thousand injury rows across two leagues still leaves every
 * other fixture priced on book quotes alone, and the page should say so.
 */
export function loadFundamentalsCoverage(db: Database = openRead()): FundamentalsCoverage {
  const row = db.query(`
    SELECT
      (SELECT COUNT(DISTINCT sports_team_id) FROM team_standings) AS teamsWithStanding,
      (SELECT COUNT(*) FROM sports_teams) AS teamsTotal,
      (SELECT COUNT(DISTINCT sports_team_id) FROM team_injuries) AS injuriesTracked,
      (SELECT COUNT(DISTINCT sports_team_id) FROM club_valuations) AS clubsValued,
      (SELECT MAX(captured_at) FROM team_standings) AS lastCapturedAt
  `).get() as Record<string, any>

  return {
    teamsWithStanding: Number(row?.teamsWithStanding ?? 0),
    teamsTotal: Number(row?.teamsTotal ?? 0),
    injuriesTracked: Number(row?.injuriesTracked ?? 0),
    clubsValued: Number(row?.clubsValued ?? 0),
    lastCapturedAt: row?.lastCapturedAt ?? null,
  }
}

export interface ProviderRun {
  provider: string
  kind: string
  status: string
  lastRunAt: string | null
  ageLabel: string
  rowsWritten: number
  summary: string
  error: string | null
}

export function loadProviderRuns(db: Database = openRead()): ProviderRun[] {
  const rows = db.query(`
    SELECT provider, kind, status, finished_at, rows_written, summary, error
    FROM ingest_runs
    WHERE id IN (SELECT MAX(id) FROM ingest_runs GROUP BY provider, kind)
    ORDER BY kind, provider
  `).all() as Array<Record<string, any>>

  return rows.map(row => ({
    provider: String(row.provider),
    kind: String(row.kind),
    status: String(row.status),
    lastRunAt: row.finished_at ?? null,
    ageLabel: relativeAge(row.finished_at),
    rowsWritten: Number(row.rows_written ?? 0),
    summary: String(row.summary ?? ''),
    error: row.error ?? null,
  }))
}

/** Coarse on purpose: the question is "recent or not", never the seconds. */
export function relativeAge(timestamp: string | null): string {
  if (!timestamp)
    return 'never'

  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(timestamp)) / 1000))
  if (seconds < 90)
    return 'just now'
  if (seconds < 3600)
    return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86_400)
    return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86_400)}d ago`
}

/**
 * The env var that switches the feed from the simulator to a real book
 * feed. Named here so the page can tell the reader exactly what to set
 * rather than describing it in prose.
 */
export const LIVE_FEED_ENV = 'ODDS_API_KEY'

export function liveFeedConfigured(): boolean {
  return Boolean(process.env[LIVE_FEED_ENV])
}
