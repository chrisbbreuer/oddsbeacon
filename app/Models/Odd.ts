import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Odd — one bookmaker's *current* price on one selection.
 *
 * Stored as **decimal odds** (e.g. 2.10) so a sportsbook line and a
 * prediction-market share price live in the same unit and compare
 * directly. The join row between {@link Bookmaker} and {@link Selection}.
 *
 * One row per (selection, bookmaker), enforced by a unique index — the
 * ingest upserts against it. Price *history* is append-only in
 * {@link OddsSnapshot}; this table only ever holds the latest.
 *
 * `impliedProb` is denormalized (1/price) so the board can filter and sort
 * on probability without recomputing across every row on every request.
 * Note it still contains the book's margin — the de-vigged number lives on
 * {@link FairPrice}, and the two must not be confused: every honest edge
 * calculation compares a price against the *fair* probability, never
 * against this one.
 */
export default defineModel({
  name: 'Odd',
  table: 'odds',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  indexes: [
    // One current price per book per selection. The ingest upsert key.
    { name: 'odds_selection_bookmaker', columns: ['selection_id', 'bookmaker_id'], unique: true },
    { name: 'odds_bookmaker', columns: ['bookmaker_id'] },
  ],

  attributes: {
    // Decimal odds. 2.00 = even money; higher = bigger payout per unit.
    price: {
      type: 'number',
      required: true,
      fillable: true,
      validation: { rule: schema.float().min(1.01) },
      factory: faker => faker.number.float({ min: 1.2, max: 9, fractionDigits: 2 }),
    },
    // American/moneyline form of `price`, precomputed for display.
    american: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.float() },
      factory: faker => faker.number.int({ min: -400, max: 400 }),
    },
    // 1/price. Includes the book's margin — see the class note.
    impliedProb: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.float().min(0).max(1) },
      factory: faker => faker.number.float({ min: 0.1, max: 0.9, fractionDigits: 4 }),
    },
    // The line this price is attached to, copied from the selection so a
    // price is self-describing without a join. Books move the line and the
    // price independently, and a stale join would misattribute both.
    point: {
      type: 'number',
      fillable: true,
      validation: { rule: schema.float() },
      factory: () => null,
    },
    // Maximum accepted stake, when the book publishes it. Liquidity is a
    // real signal: a sharp price with a $50 limit is not the same market
    // as the same price with a $50k limit.
    limitAmount: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.float().min(0) },
      factory: () => 0,
    },
    // Whether the book is currently taking action on this selection.
    available: {
      type: 'boolean',
      fillable: true,
      default: true,
      validation: { rule: schema.boolean() },
      factory: () => true,
    },
    // When the provider says this price was last set — not when we wrote
    // it. Books report their own timestamps and they lag polling.
    observedAt: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(40) },
      factory: () => new Date().toISOString(),
    },
  },

  belongsTo: ['Selection', 'Bookmaker'],
} as const)
