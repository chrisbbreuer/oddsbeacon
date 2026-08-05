import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/** Provider-specific identity for a canonical team, club, franchise, or nation. */
export default defineModel({
  name: 'TeamIdentity', table: 'team_identities', primaryKey: 'id', autoIncrement: true,
  traits: { useTimestamps: true, useSeeder: { count: 0 } },
  indexes: [
    { name: 'team_identities_provider_external', columns: ['provider', 'external_id'], unique: true },
    { name: 'team_identities_team', columns: ['sports_team_id'] },
  ],
  attributes: {
    provider: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(40) }, factory: () => 'transfermarkt' },
    externalId: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(120) }, factory: faker => faker.string.alphanumeric(12) },
    canonicalUrl: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(500) }, factory: () => '' },
    externalName: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    lastSeenAt: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(40) }, factory: () => '' },
  },
  belongsTo: ['SportsTeam'],
} as const)
