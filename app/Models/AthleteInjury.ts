import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/** Historical availability interval, independent of any one live injury capture. */
export default defineModel({
  name: 'AthleteInjury', table: 'athlete_injuries', primaryKey: 'id', autoIncrement: true,
  traits: { useTimestamps: true, useSeeder: { count: 0 } },
  indexes: [
    { name: 'athlete_injuries_natural', columns: ['athlete_id', 'provider', 'started_on', 'injury_type'], unique: true },
    { name: 'athlete_injuries_dates', columns: ['athlete_id', 'started_on', 'ended_on'] },
  ],
  attributes: {
    injuryType: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(160) }, factory: () => 'Unknown' },
    startedOn: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    endedOn: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    daysMissed: { type: 'integer', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    gamesMissed: { type: 'integer', fillable: true, default: 0, validation: { rule: schema.number().min(0) }, factory: () => 0 },
    status: { type: 'string', fillable: true, default: 'resolved', validation: { rule: schema.string().max(40) }, factory: () => 'resolved' },
    provider: { type: 'string', fillable: true, default: 'transfermarkt', validation: { rule: schema.string().max(40) }, factory: () => 'transfermarkt' },
  },
  belongsTo: ['Athlete'],
} as const)
