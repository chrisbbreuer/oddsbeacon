import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/** Stable provider identity and canonical profile URL for an athlete. */
export default defineModel({
  name: 'AthleteIdentity', table: 'athlete_identities', primaryKey: 'id', autoIncrement: true,
  traits: { useTimestamps: true, useSeeder: { count: 0 } },
  indexes: [
    { name: 'athlete_identities_provider_external', columns: ['provider', 'external_id'], unique: true },
    { name: 'athlete_identities_athlete', columns: ['athlete_id'] },
  ],
  attributes: {
    provider: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(40) }, factory: () => 'transfermarkt' },
    externalId: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(120) }, factory: faker => faker.string.alphanumeric(12) },
    canonicalUrl: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(500) }, factory: () => '' },
    externalName: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    aliases: { type: 'string', fillable: true, default: '[]', validation: { rule: schema.string().max(4000) }, factory: () => '[]' },
    profileFacts: { type: 'string', fillable: true, default: '{}', validation: { rule: schema.string().max(16000) }, factory: () => '{}' },
    lastSeenAt: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(40) }, factory: () => '' },
  },
  belongsTo: ['Athlete'],
} as const)
