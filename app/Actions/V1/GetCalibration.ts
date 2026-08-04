import type { RequestLike } from '../../Support/api'
import { freshness, ok, Params } from '../../Support/api'
import { openRead } from '../../Support/db'

/**
 * GET /api/v1/calibration — how well the model's probabilities hold up.
 *
 * Published rather than kept internal, deliberately. A service that states
 * probabilities and will not show its calibration is asking to be taken on
 * faith; one that shows the curve can be checked. It also keeps the team
 * honest, since a drifting curve becomes visible to everyone at once.
 *
 * An empty response is the correct answer before enough markets have
 * settled — a reliability curve from a handful of results is noise, and
 * fabricating one would be worse than showing none.
 */
export default {
  name: 'V1GetCalibration',
  description: 'Reliability curve, Brier score, and log loss for the fair-value model.',

  async handle(request?: RequestLike) {
    const params = new Params(request)
    const scope = params.string('scope', { allow: ['overall', 'sport', 'market_type'] }) ?? 'overall'
    const scopeKey = params.string('key', { max: 60 }) ?? ''

    const invalid = params.invalid()
    if (invalid)
      return invalid

    const db = openRead()
    try {
      const buckets = db.query(`
        SELECT bucket_lower, bucket_upper, predicted_avg, observed_rate,
               sample_size, brier_score, log_loss, avg_clv_pct, computed_at
        FROM calibration_buckets
        WHERE scope = ? AND scope_key = ?
        ORDER BY bucket_lower ASC
      `).all(scope, scopeKey) as Array<Record<string, any>>

      const sampleSize = buckets.reduce((sum, b) => sum + b.sample_size, 0)

      // Sample-weighted, not a mean of bucket means: buckets hold very
      // different counts, and averaging their scores directly would let a
      // three-sample bucket weigh as heavily as a three-thousand one.
      const weighted = (field: string) => sampleSize > 0
        ? buckets.reduce((sum, b) => sum + b[field] * b.sample_size, 0) / sampleSize
        : 0

      return ok(
        {
          scope,
          scopeKey,
          sampleSize,
          brierScore: weighted('brier_score'),
          logLoss: weighted('log_loss'),
          avgClvPct: weighted('avg_clv_pct'),
          buckets: buckets.map(b => ({
            lower: b.bucket_lower,
            upper: b.bucket_upper,
            predicted: b.predicted_avg,
            observed: b.observed_rate,
            sampleSize: b.sample_size,
            brierScore: b.brier_score,
            logLoss: b.log_loss,
            avgClvPct: b.avg_clv_pct,
          })),
          computedAt: buckets[0]?.computed_at ?? null,
        },
        // Calibration moves only when markets settle, so it tolerates a
        // far longer cache than anything price-derived.
        { request, cacheSeconds: 300, meta: { freshness: freshness() } },
      )
    }
    finally {
      db.close()
    }
  },
}
