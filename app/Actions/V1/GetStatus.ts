import { ok } from '../../Support/api'
import { openRead } from '../../Support/db'

/**
 * GET /api/v1/status — is the data current, and how much of it is there?
 *
 * Exists so staleness is answerable from outside the system. A board that
 * has stopped updating looks exactly like a quiet night unless something
 * reports when each provider last succeeded and what it wrote, which is
 * how a feed matching nothing previously went unnoticed indefinitely.
 */
export default {
  name: 'V1GetStatus',
  description: 'Ingestion health, data counts, and per-provider freshness.',

  async handle() {
    const db = openRead()
    try {
      const runs = await db.query<Record<string, any>>(`
        SELECT provider, kind, status, started_at, finished_at, duration_ms,
              rows_read, rows_written, unmatched_count, quota_remaining, error, summary
        FROM ingest_runs r
        WHERE r.id IN (
          SELECT MAX(id) FROM ingest_runs GROUP BY provider, kind
        )
        ORDER BY provider, kind
      `).all()

      const counts = await db.query<Record<string, number>>(`
        SELECT
          (SELECT COUNT(*) FROM sports WHERE active = 1) AS sports,
          (SELECT COUNT(*) FROM bookmakers WHERE active = 1) AS bookmakers,
          (SELECT COUNT(*) FROM sports_teams) AS teams,
          (SELECT COUNT(*) FROM market_events) AS events,
          (SELECT COUNT(*) FROM market_events WHERE status = 'scheduled') AS upcomingEvents,
          (SELECT COUNT(*) FROM markets) AS markets,
          (SELECT COUNT(*) FROM selections) AS selections,
          (SELECT COUNT(*) FROM odds) AS odds,
          (SELECT COUNT(*) FROM odds_snapshots) AS priceHistory,
          (SELECT COUNT(*) FROM fair_prices) AS fairPrices,
          (SELECT COUNT(*) FROM closing_lines) AS closingLines,
          (SELECT COUNT(*) FROM event_results) AS results,
          (SELECT COUNT(*) FROM feature_snapshots) AS featureSnapshots,
          (SELECT COUNT(*) FROM feature_snapshots WHERE label != -1) AS labelledSnapshots,
          (SELECT COUNT(*) FROM ai_insights) AS aiInsights
      `).get() ?? {}

      const now = Date.now()
      const providers = runs.map(r => ({
        provider: r.provider,
        kind: r.kind,
        status: r.status,
        lastRunAt: r.finished_at || r.started_at,
        // The number that matters operationally. A pass that succeeded six
        // hours ago is a failure that has not been noticed yet.
        ageSeconds: Math.round((now - Date.parse(r.finished_at || r.started_at)) / 1000),
        durationMs: r.duration_ms,
        rowsRead: r.rows_read,
        rowsWritten: r.rows_written,
        unmatched: r.unmatched_count,
        quotaRemaining: r.quota_remaining >= 0 ? r.quota_remaining : null,
        error: r.error || null,
        summary: r.summary || null,
      }))

      const degraded = providers.filter(p => p.status === 'failed' || p.ageSeconds > 3600)

      return ok(
        {
          healthy: degraded.length === 0,
          degraded: degraded.map(p => `${p.provider}/${p.kind}`),
          providers,
          counts,
        },
        { cacheSeconds: 10 },
      )
    }
    finally {
      db.close()
    }
  },
}
