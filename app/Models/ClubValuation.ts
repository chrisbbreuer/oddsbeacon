import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * ClubValuation — what a squad is worth, and what division it plays in.
 *
 * Built for the mismatch case. Kalshi lists cup ties and friendlies that
 * put a first-division side against a fourth-division one, and nothing
 * else this system reads can tell those apart: the fixture arrives as two
 * names and a price, and fair value is a de-vigged consensus of the same
 * books that may be mispricing it. Squad value and league tier are an
 * outside opinion, which is the only kind that can disagree with a book
 * rather than average it.
 *
 * `leagueTier` carries most of the signal on its own and is the cheapest
 * field to source, so it is usable before any valuation provider is
 * configured. 1 is the top division of a country.
 *
 * Values are stored in whole euros because that is the unit the sources
 * publish in; converting on read keeps one number canonical.
 */
export default defineModel({
  name: 'ClubValuation',
  table: 'club_valuations',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  indexes: [
    { name: 'club_valuations_team_captured', columns: ['sports_team_id', 'captured_at'] },
  ],

  attributes: {
    /** Total squad market value in euros. 0 when unknown. */
    squadValueEur: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.float().min(0) },
      factory: faker => faker.number.int({ min: 1_000_000, max: 1_200_000_000 }),
    },
    squadSize: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 16, max: 40 }),
    },
    averageAgeYears: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.float().min(0).max(60) },
      factory: faker => faker.number.float({ min: 21, max: 31 }),
    },
    /**
     * Division depth, 1 = top flight. The field that answers "is this a
     * mismatch" even with no valuation attached, which is why it is
     * separate from the money and defaults to 0 for unknown rather than
     * to 1, so an unknown club is never mistaken for a top-flight one.
     */
    leagueTier: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0).max(20) },
      factory: faker => faker.number.int({ min: 1, max: 5 }),
    },
    /** Competition the tier refers to, e.g. 'EFL League Two'. */
    competition: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(120) },
      factory: () => '',
    },
    source: {
      type: 'string',
      fillable: true,
      default: 'transfermarkt',
      validation: { rule: schema.string().min(1).max(40) },
      factory: () => 'transfermarkt',
    },
    /** The provider's own id for this club, for re-fetching without re-matching. */
    externalId: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(80) },
      factory: () => '',
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
