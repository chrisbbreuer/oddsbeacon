import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * BetSheetItem — one leg of a saved {@link BetSheet}: the picked outcome,
 * the bookmaker offering the price, and a denormalized game/league label
 * so a sheet renders without re-joining the whole board.
 */
export default defineModel({
  name: 'BetSheetItem',
  table: 'bet_sheet_items',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  attributes: {
    pick: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().min(1).max(100) },
      factory: faker => faker.helpers.arrayElement(['Lakers', 'Celtics', 'Over', 'Under']),
    },
    game: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().max(200) },
      factory: () => 'Team A vs Team B',
    },
    league: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().max(60) },
      factory: () => 'NBA',
    },
    price: {
      type: 'number',
      fillable: true,
      validation: { rule: schema.number().min(1.01) },
      factory: faker => faker.number.float({ min: 1.2, max: 9, fractionDigits: 2 }),
    },
  },

  belongsTo: ['BetSheet'],
} as const)
