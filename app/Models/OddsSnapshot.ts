import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * OddsSnapshot — a point-in-time price for one bookmaker on one selection.
 *
 * Written by the ingestion job on every refresh so we can chart line
 * movement (open → current), draw sparklines, and flag steam/sharp moves.
 */
export default defineModel({
  name: 'OddsSnapshot',
  table: 'odds_snapshots',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  attributes: {
    price: {
      type: 'number',
      fillable: true,
      validation: { rule: schema.number().min(1.01) },
      factory: faker => faker.number.float({ min: 1.2, max: 9, fractionDigits: 2 }),
    },
    // ISO timestamp of when this price was observed.
    capturedAt: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string() },
      factory: () => '2026-06-28 12:00:00',
    },
  },

  belongsTo: ['Selection', 'Bookmaker'],
} as const)
