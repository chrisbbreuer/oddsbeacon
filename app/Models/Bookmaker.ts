import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Bookmaker — a place that quotes a price on an outcome.
 *
 * Covers both traditional sportsbooks (DraftKings, Pinnacle, …) and
 * prediction markets (Polymarket, Kalshi, …). `kind` keeps the two
 * apart in the UI while their prices are compared in the same grid.
 */
export default defineModel({
  name: 'Bookmaker',
  table: 'bookmakers',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  attributes: {
    name: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().min(1).max(100) },
      factory: faker => faker.company.name(),
    },
    slug: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().min(1).max(100) },
      factory: faker => faker.lorem.slug(),
    },
    // 'sportsbook' | 'prediction'
    kind: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().min(1).max(20) },
      factory: faker => faker.helpers.arrayElement(['sportsbook', 'prediction']),
    },
    // crosswind text-color token used for the book's badge
    accent: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().max(40) },
      factory: () => 'text-slate-300',
    },
    // short mark for compact column headers, e.g. "DK", "PIN"
    short: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().max(8) },
      factory: faker => faker.string.alpha({ length: 3, casing: 'upper' }),
    },
  },

  hasMany: ['Odd'],
} as const)
