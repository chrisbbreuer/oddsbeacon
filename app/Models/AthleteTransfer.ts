import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/** A career transaction: transfer, loan, draft, trade, release, or retirement. */
export default defineModel({
  name: 'AthleteTransfer', table: 'athlete_transfers', primaryKey: 'id', autoIncrement: true,
  traits: { useTimestamps: true, useSeeder: { count: 0 } },
  indexes: [
    { name: 'athlete_transfers_natural', columns: ['athlete_id', 'provider', 'external_id'], unique: true },
    { name: 'athlete_transfers_date', columns: ['athlete_id', 'transferred_on'] },
  ],
  attributes: {
    fromSportsTeamId: { type: 'bigint', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    toSportsTeamId: { type: 'bigint', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    fromTeamName: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    toTeamName: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    kind: { type: 'string', fillable: true, default: 'transfer', validation: { rule: schema.string().max(40) }, factory: () => 'transfer' },
    season: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    transferredOn: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    feeEur: { type: 'bigint', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    marketValueEur: { type: 'bigint', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    provider: { type: 'string', fillable: true, default: 'transfermarkt', validation: { rule: schema.string().max(40) }, factory: () => 'transfermarkt' },
    externalId: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(200) }, factory: faker => faker.string.uuid() },
  },
  belongsTo: ['Athlete'],
} as const)
