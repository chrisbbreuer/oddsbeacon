import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Selection — one possible outcome of a {@link MarketEvent}.
 *
 * "Lakers", "Draw", "Yes", "Chiefs". Each selection collects one
 * {@link Odd} per bookmaker; the best of those is what OddsBeacon
 * highlights.
 */
export default defineModel({
  name: 'Selection',
  table: 'selections',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  attributes: {
    label: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().min(1).max(100) },
      factory: faker => faker.helpers.arrayElement(['Home', 'Draw', 'Away', 'Yes', 'No']),
    },
    // Stable position so a market always renders rows in a known order.
    position: {
      type: 'number',
      fillable: true,
      validation: { rule: schema.number().min(0) },
      factory: () => 0,
    },
  },

  belongsTo: ['MarketEvent'],
  hasMany: ['Odd'],
} as const)
