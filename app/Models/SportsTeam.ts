import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * SportsTeam — a competitor in a {@link Sport}.
 *
 * Named `SportsTeam` rather than `Team` because the framework already
 * ships a `Team` model for account/organization membership; the two would
 * collide in the model registry.
 *
 * This model exists to solve the matching problem. Feeds disagree about
 * names for the same club — ESPN says "Los Angeles Lakers", The Odds API
 * says "Los Angeles Lakers", a prediction market says "LAL" — so the
 * ingestion layer resolves every incoming name to a row here and joins on
 * the id instead. `aliases` carries the extra spellings seen in the wild,
 * newline-separated, and `searchKey` is the normalized primary name so an
 * exact-match lookup handles the common case without scanning aliases.
 */
export default defineModel({
  name: 'SportsTeam',
  table: 'sports_teams',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  indexes: [
    // The lookup the resolver hits on every ingested competitor.
    { name: 'sports_teams_sport_search_key', columns: ['sport_id', 'search_key'], unique: true },
    { name: 'sports_teams_espn_id', columns: ['espn_id'] },
  ],

  attributes: {
    name: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(120) },
      factory: faker => `${faker.location.city()} ${faker.animal.type()}`,
    },
    // Normalized `name` (lowercased, alphanumeric only) — the join key.
    searchKey: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(120) },
      factory: faker => faker.lorem.slug(),
    },
    shortName: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(60) },
      factory: faker => faker.location.city(),
    },
    abbreviation: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(8) },
      factory: faker => faker.string.alpha({ length: 3, casing: 'upper' }),
    },
    // Alternate spellings seen from feeds, one per line. Consulted when
    // `searchKey` misses, and appended to whenever a fuzzy match resolves.
    aliases: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(2000) },
      factory: () => '',
    },
    logo: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(300) },
      factory: () => '',
    },
    espnId: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(40) },
      factory: faker => String(faker.number.int({ min: 1, max: 40 })),
    },
    // Latest overall record ("42-18"), refreshed by the scoreboard pass.
    record: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(40) },
      factory: () => '',
    },
  },

  belongsTo: ['Sport'],
  hasMany: ['Athlete', 'AthleteTeamMembership', 'TeamIdentity'],
} as const)
