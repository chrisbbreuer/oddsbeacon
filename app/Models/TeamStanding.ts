import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * TeamStanding — how a {@link SportsTeam} is actually doing.
 *
 * The first non-market input this system has. Everything else it prices
 * with is derived from bookmaker quotes, which means the model can only
 * ever agree with the books in a smoothed way: it cannot tell you they
 * are wrong, because their prices are its only evidence. A record and a
 * scoring differential are an independent read on the same question.
 *
 * One row per team per capture rather than an updating row, so a
 * prediction made in March can be scored against what was knowable in
 * March. Overwriting would leak later information into the training set
 * and produce a model that backtests beautifully and fails live, which is
 * the same reason `feature_snapshots` is append-only.
 */
export default defineModel({
  name: 'TeamStanding',
  table: 'team_standings',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  indexes: [
    // The read every strength lookup does: latest row for a team.
    { name: 'team_standings_team_captured', columns: ['sports_team_id', 'captured_at'] },
  ],

  attributes: {
    wins: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 82 }),
    },
    losses: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 82 }),
    },
    // Draws. Zero in sports that cannot draw, rather than null.
    ties: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: () => 0,
    },
    gamesPlayed: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 0, max: 162 }),
    },
    /** 0..1. Stored rather than derived so a tie-weighting change cannot silently rewrite history. */
    winPercent: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.float().min(0).max(1) },
      factory: faker => faker.number.float({ min: 0, max: 1 }),
    },
    pointsFor: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.float() },
      factory: faker => faker.number.int({ min: 0, max: 900 }),
    },
    pointsAgainst: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.float() },
      factory: faker => faker.number.int({ min: 0, max: 900 }),
    },
    /**
     * pointsFor − pointsAgainst. A better strength estimate than record
     * over small samples: a team can be 6-4 having been outscored badly,
     * and the differential says so while the record does not.
     */
    pointDifferential: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.float() },
      factory: faker => faker.number.int({ min: -200, max: 200 }),
    },
    /** Seed within the group, 0 when the feed does not publish one. */
    playoffSeed: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: () => 0,
    },
    /** Conference, division, or league table this row was read from. */
    groupName: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(80) },
      factory: () => '',
    },
    source: {
      type: 'string',
      fillable: true,
      default: 'espn',
      validation: { rule: schema.string().min(1).max(40) },
      factory: () => 'espn',
    },
    capturedAt: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(40) },
      factory: () => new Date().toISOString(),
    },
  },

  belongsTo: ['SportsTeam'],
} as const)
