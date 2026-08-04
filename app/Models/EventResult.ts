import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * EventResult — how a {@link MarketEvent} actually finished.
 *
 * This is the single most valuable table in the schema and the one that
 * did not previously exist. Scores were fetched from ESPN for display and
 * then discarded, which left the system with no ground truth: no way to
 * grade a selection, score a prediction, measure calibration, or train
 * anything. Every number the product claimed about accuracy would have
 * been unfalsifiable.
 *
 * With results persisted, `outcome` on each {@link Selection} can be
 * settled, closing lines can be scored, and the {@link FeatureSnapshot}
 * rows collected before kickoff gain the label that makes them a training
 * set rather than a log.
 *
 * `periodScores` holds per-quarter/period JSON so half and quarter markets
 * can be graded from the same row as the full-game ones.
 */
export default defineModel({
  name: 'EventResult',
  table: 'event_results',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  casts: {
    periodScores: 'json',
  },

  indexes: [
    // One result per event.
    { name: 'event_results_event', columns: ['market_event_id'], unique: true },
  ],

  attributes: {
    homeScore: {
      type: 'number',
      required: true,
      fillable: true,
      default: 0,
      validation: { rule: schema.float() },
      factory: faker => faker.number.int({ min: 0, max: 130 }),
    },
    awayScore: {
      type: 'number',
      required: true,
      fillable: true,
      default: 0,
      validation: { rule: schema.float() },
      factory: faker => faker.number.int({ min: 0, max: 130 }),
    },
    // 'home' | 'away' | 'draw' — the settled side of the moneyline.
    winnerSide: {
      type: 'string',
      required: true,
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(20) },
      factory: faker => faker.helpers.arrayElement(['home', 'away', 'draw']),
    },
    // Per-period scores as JSON, e.g. {"home":[28,31,25,24],"away":[…]}.
    periodScores: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string() },
      factory: () => '',
    },
    // Whether the game finished normally. A postponement or abandonment
    // voids markets rather than settling them, so grading must branch on
    // this instead of assuming a final score means a decided market.
    completed: {
      type: 'boolean',
      fillable: true,
      default: true,
      validation: { rule: schema.boolean() },
      factory: () => true,
    },
    // Provider whose scoreboard settled this, for auditing a bad grade.
    source: {
      type: 'string',
      fillable: true,
      default: 'espn',
      validation: { rule: schema.string().max(40) },
      factory: () => 'espn',
    },
    settledAt: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(40) },
      factory: () => new Date().toISOString(),
    },
    // Set once every selection under this event has been graded, so the
    // settlement sweep can skip finished work.
    gradedAt: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(40) },
      factory: () => '',
    },
  },

  belongsTo: ['MarketEvent'],
} as const)
