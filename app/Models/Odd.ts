import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Odd — one bookmaker's price on one selection.
 *
 * Stored as **decimal odds** (e.g. 2.10) so a sportsbook line and a
 * prediction-market share price live in the same unit and compare
 * directly. The join row between {@link Bookmaker} and {@link Selection}.
 */
export default defineModel({
  name: 'Odd',
  table: 'odds',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  attributes: {
    // Decimal odds. 2.00 = even money; higher = bigger payout per unit.
    price: {
      type: 'number',
      fillable: true,
      validation: { rule: schema.number().min(1.01) },
      factory: faker => faker.number.float({ min: 1.2, max: 9, fractionDigits: 2 }),
    },
  },

  belongsTo: ['Selection', 'Bookmaker'],
} as const)
