import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/** Canonical person competing in any supported sport. */
export default defineModel({
  name: 'Athlete',
  table: 'athletes',
  primaryKey: 'id',
  autoIncrement: true,
  traits: {
    useTimestamps: true,
    useSeeder: { count: 0 },
    // The participants endpoint a paid feed charges for. Read-only for the
    // same reason as `Sport`: this is a roster, and the generated write
    // routes would let a caller edit the people every player prop resolves
    // against.
    useApi: {
      uri: 'participants',
      routes: ['index', 'show'],
    },
  },
  indexes: [
    { name: 'athletes_sport_search_key', columns: ['sport_id', 'search_key'] },
    { name: 'athletes_current_team', columns: ['sports_team_id'] },
  ],
  attributes: {
    name: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(160) }, factory: faker => faker.person.fullName() },
    searchKey: { type: 'string', required: true, fillable: true, validation: { rule: schema.string().min(1).max(180) }, factory: faker => faker.lorem.slug() },
    givenName: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(100) }, factory: () => '' },
    familyName: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(100) }, factory: () => '' },
    dateOfBirth: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    placeOfBirth: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    nationality: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(100) }, factory: () => '' },
    secondNationality: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(100) }, factory: () => '' },
    position: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(100) }, factory: () => '' },
    secondaryPositions: { type: 'string', fillable: true, default: '[]', validation: { rule: schema.string().max(1000) }, factory: () => '[]' },
    heightCm: { type: 'integer', fillable: true, default: 0, validation: { rule: schema.number().min(0).max(300) }, factory: () => 0 },
    preferredFoot: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    shirtNumber: { type: 'integer', fillable: true, default: 0, validation: { rule: schema.number().min(0).max(999) }, factory: () => 0 },
    joinedOn: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    contractExpiresOn: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(20) }, factory: () => '' },
    agentName: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(160) }, factory: () => '' },
    outfitter: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(120) }, factory: () => '' },
    status: { type: 'string', fillable: true, default: 'active', validation: { rule: schema.enum(['active', 'inactive', 'retired', 'deceased']) }, factory: () => 'active' },
    imageUrl: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(500) }, factory: () => '' },
    lastSeenAt: { type: 'string', fillable: true, default: '', validation: { rule: schema.string().max(40) }, factory: () => '' },
  },
  belongsTo: ['Sport', 'SportsTeam'],
  hasMany: ['AthleteIdentity', 'AthleteTeamMembership', 'AthleteTransfer', 'AthleteMarketValue', 'AthleteSeasonStat', 'AthleteInjury', 'AthleteCareerRecord'],
} as const)
