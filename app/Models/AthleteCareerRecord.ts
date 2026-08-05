import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Provider-scoped career fact that has no universal box-score shape.
 *
 * Common histories stay in their structured tables (transfers, injuries,
 * memberships, values, season stats). This record preserves complete labeled
 * rows for honours, national-team history, suspensions, shirt numbers, and
 * equivalent sections other sports/providers expose without discarding data.
 */
export default defineModel({
  name: 'AthleteCareerRecord', table: 'athlete_career_records', primaryKey: 'id', autoIncrement: true,
  traits: { useTimestamps: true, useSeeder: { count: 0 } },
  indexes: [
    { name: 'athlete_career_records_natural', columns: ['athlete_id', 'provider', 'category', 'external_id'], unique: true },
    { name: 'athlete_career_records_timeline', columns: ['athlete_id', 'category', 'occurred_on'] },
  ],
  attributes: {
    provider: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(40) }, factory: () => 'transfermarkt' },
    category: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(60) }, factory: () => 'achievement' },
    externalId: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(64) }, factory: faker => faker.string.uuid() },
    title: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(240) }, factory: () => '' },
    season: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    competition: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    sportsTeamId: { type: 'bigint', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    teamName: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    occurredOn: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    endedOn: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    details: { type: 'string', fillable: true, default: '{}', validation: { rule: schema.string().max(32000) }, factory: () => '{}' },
  },
  belongsTo: ['Athlete'],
} as const)
