import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/** One immutable interval in an athlete's club, franchise, or national-team career. */
export default defineModel({
  name: 'AthleteTeamMembership', table: 'athlete_team_memberships', primaryKey: 'id', autoIncrement: true,
  traits: { useTimestamps: true, useSeeder: { count: 0 } },
  indexes: [
    { name: 'athlete_memberships_natural', columns: ['athlete_id', 'sports_team_id', 'started_on'], unique: true },
    { name: 'athlete_memberships_team_dates', columns: ['sports_team_id', 'started_on', 'ended_on'] },
  ],
  attributes: {
    startedOn: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    endedOn: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    squadNumber: { type: 'integer', fillable: true, default: 0, validation: { rule: schema.number().min(0).max(999) }, factory: () => 0 },
    role: { type: 'string', fillable: true, default: 'player', validation: { rule: schema.string().max(40) }, factory: () => 'player' },
    competition: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    source: { type: 'string', fillable: true, default: 'transfermarkt', validation: { rule: schema.string().max(40) }, factory: () => 'transfermarkt' },
  },
  belongsTo: ['Athlete', 'SportsTeam'],
} as const)
