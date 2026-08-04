import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * IngestRun — one pass of one provider, and what came of it.
 *
 * Data you cannot audit is data you cannot trust. Before this table, an
 * ingestion pass that matched nothing and one that was never scheduled
 * looked identical from the outside: the board simply stopped moving, and
 * the synthetic fallback made even that hard to notice. The real feed had
 * in fact been failing to match anything at all, silently, because there
 * was nowhere for "fetched 4,000 prices, matched 0" to be recorded.
 *
 * Every pass writes a row here whether it succeeds or fails, so staleness
 * is a query rather than a hunch, and so the API can honestly report when
 * each source was last known good.
 *
 * `quotaRemaining` tracks the paid feed's budget from its response
 * headers — running out mid-month degrades coverage in a way that is
 * otherwise invisible until someone notices missing books.
 */
export default defineModel({
  name: 'IngestRun',
  table: 'ingest_runs',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  indexes: [
    // "When did this provider last succeed?" — the staleness query.
    { name: 'ingest_runs_provider_started', columns: ['provider', 'started_at'] },
    { name: 'ingest_runs_status', columns: ['status'] },
  ],

  attributes: {
    // 'espn' | 'the-odds-api' | 'kalshi' | 'polymarket' | 'synthetic'
    provider: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(40) },
      factory: faker => faker.helpers.arrayElement(['espn', 'the-odds-api', 'kalshi', 'polymarket']),
    },
    // What the pass was doing: 'odds' | 'scores' | 'schedule' | 'trades' | 'settle'
    kind: {
      type: 'string',
      required: true,
      fillable: true,
      default: 'odds',
      validation: { rule: schema.string().min(1).max(40) },
      factory: () => 'odds',
    },
    // 'running' | 'success' | 'partial' | 'failed'
    // 'partial' is its own state on purpose: a pass where three leagues
    // updated and two timed out is neither a success nor a failure, and
    // collapsing it into either one loses the signal that coverage slipped.
    status: {
      type: 'string',
      required: true,
      fillable: true,
      default: 'running',
      validation: { rule: schema.enum(['running', 'success', 'partial', 'failed']) },
      factory: () => 'success',
    },
    startedAt: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(40) },
      factory: () => new Date().toISOString(),
    },
    finishedAt: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(40) },
      factory: () => '',
    },
    durationMs: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 50, max: 20_000 }),
    },
    // Requests issued, rows the provider returned, rows we actually wrote.
    // The gap between read and written is the matching yield — the number
    // whose collapse to zero previously went unnoticed.
    requestCount: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 1, max: 30 }),
    },
    rowsRead: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 5000 }),
    },
    rowsWritten: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 5000 }),
    },
    // Incoming records we could not attach to a known event or selection.
    unmatchedCount: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: () => 0,
    },
    // Remaining monthly credits, from the provider's response headers.
    quotaRemaining: {
      type: 'number',
      fillable: true,
      default: -1,
      validation: { rule: schema.float() },
      factory: () => -1,
    },
    quotaUsed: {
      type: 'number',
      fillable: true,
      default: -1,
      validation: { rule: schema.float() },
      factory: () => -1,
    },
    // First error message, truncated. Empty on a clean pass.
    error: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(1000) },
      factory: () => '',
    },
    // Short human summary for the status endpoint and the dashboard.
    summary: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(500) },
      factory: () => '',
    },
  },
} as const)
