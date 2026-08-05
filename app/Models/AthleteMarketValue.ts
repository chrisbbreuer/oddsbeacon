import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/** Point-in-time provider valuation retained as an immutable series. */
export default defineModel({
  name: 'AthleteMarketValue', table: 'athlete_market_values', primaryKey: 'id', autoIncrement: true,
  traits: { useTimestamps: true, useSeeder: { count: 0 } },
  indexes: [
    { name: 'athlete_values_natural', columns: ['athlete_id', 'provider', 'valued_on'], unique: true },
    { name: 'athlete_values_date', columns: ['athlete_id', 'valued_on'] },
  ],
  attributes: {
    valueEur: { type: 'bigint', required: true, fillable: true, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    valuedOn: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(20) }, factory: () => '' },
    teamName: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    provider: { type: 'string', fillable: true, default: 'transfermarkt', validation: { rule: schema.string().max(40) }, factory: () => 'transfermarkt' },
  },
  belongsTo: ['Athlete'],
} as const)
