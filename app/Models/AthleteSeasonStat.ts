import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/** Cross-sport season aggregate with common totals plus provider-specific metrics JSON. */
export default defineModel({
  name: 'AthleteSeasonStat', table: 'athlete_season_stats', primaryKey: 'id', autoIncrement: true,
  traits: { useTimestamps: true, useSeeder: { count: 0 } },
  indexes: [
    { name: 'athlete_stats_natural', columns: ['athlete_id', 'provider', 'season', 'competition', 'sports_team_id'], unique: true },
    { name: 'athlete_stats_lookup', columns: ['athlete_id', 'season'] },
  ],
  attributes: {
    sportsTeamId: { type: 'bigint', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    season: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(20) }, factory: () => '' },
    competition: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    appearances: { type: 'integer', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    starts: { type: 'integer', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    minutes: { type: 'integer', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    points: { type: 'double', fillable: true, default: 0, validation: { rule: schema.float() }, factory: () => 0 },
    goals: { type: 'integer', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    assists: { type: 'integer', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    metrics: { type: 'string', fillable: true, default: '{}', validation: { rule: schema.string().max(16000) }, factory: () => '{}' },
    provider: { type: 'string', fillable: true, default: 'transfermarkt', validation: { rule: schema.string().max(40) }, factory: () => 'transfermarkt' },
  },
  belongsTo: ['Athlete'],
} as const)
