import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Sport — one league we track, and the keys each provider knows it by.
 *
 * Every provider names the same league differently: ESPN wants the path
 * `basketball/nba`, The Odds API wants the key `basketball_nba`, and our
 * own URLs want the slug `nba`. Holding all three on one row is what lets
 * the ingestion layer fan out across providers from a single list rather
 * than three hardcoded arrays that drift apart.
 *
 * `active` gates polling. Turning a league off stops the network calls
 * without deleting the events already ingested under it.
 */
export default defineModel({
  name: 'Sport',
  table: 'sports',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    // Reference data, not sample data: these are the real leagues and the
    // real provider keys, so a freshly-seeded database can immediately
    // ingest live events rather than showing invented ones. Generating
    // random sports here would produce rows no provider can resolve.
    useSeeder: {
      count: 0,
      fixtures: [
        { slug: 'nfl', title: 'NFL', grouping: 'Football', espnPath: 'football/nfl', oddsApiKey: 'americanfootball_nfl', position: 1, active: true, nonSporting: false },
        { slug: 'nba', title: 'NBA', grouping: 'Basketball', espnPath: 'basketball/nba', oddsApiKey: 'basketball_nba', position: 2, active: true, nonSporting: false },
        { slug: 'mlb', title: 'MLB', grouping: 'Baseball', espnPath: 'baseball/mlb', oddsApiKey: 'baseball_mlb', position: 3, active: true, nonSporting: false },
        { slug: 'nhl', title: 'NHL', grouping: 'Hockey', espnPath: 'hockey/nhl', oddsApiKey: 'icehockey_nhl', position: 4, active: true, nonSporting: false },
        { slug: 'ncaaf', title: 'NCAA Football', grouping: 'Football', espnPath: 'football/college-football', oddsApiKey: 'americanfootball_ncaaf', position: 5, active: true, nonSporting: false },
        { slug: 'ncaab', title: 'NCAA Basketball', grouping: 'Basketball', espnPath: 'basketball/mens-college-basketball', oddsApiKey: 'basketball_ncaab', position: 6, active: true, nonSporting: false },
        { slug: 'epl', title: 'Premier League', grouping: 'Soccer', espnPath: 'soccer/eng.1', oddsApiKey: 'soccer_epl', position: 7, active: true, nonSporting: false },
        { slug: 'laliga', title: 'La Liga', grouping: 'Soccer', espnPath: 'soccer/esp.1', oddsApiKey: 'soccer_spain_la_liga', position: 8, active: true, nonSporting: false },
        { slug: 'seriea', title: 'Serie A', grouping: 'Soccer', espnPath: 'soccer/ita.1', oddsApiKey: 'soccer_italy_serie_a', position: 9, active: true, nonSporting: false },
        { slug: 'bundesliga', title: 'Bundesliga', grouping: 'Soccer', espnPath: 'soccer/ger.1', oddsApiKey: 'soccer_germany_bundesliga', position: 10, active: true, nonSporting: false },
        { slug: 'ucl', title: 'Champions League', grouping: 'Soccer', espnPath: 'soccer/uefa.champions', oddsApiKey: 'soccer_uefa_champs_league', position: 11, active: true, nonSporting: false },
        { slug: 'mma', title: 'MMA', grouping: 'Combat', espnPath: 'mma/ufc', oddsApiKey: 'mma_mixed_martial_arts', position: 12, active: true, nonSporting: false },
        // Prediction-venue only: no scoreboard, no home/away side.
        { slug: 'politics', title: 'Politics', grouping: 'Politics', espnPath: '', oddsApiKey: '', position: 20, active: true, nonSporting: true },
        { slug: 'economics', title: 'Economics', grouping: 'Economics', espnPath: '', oddsApiKey: '', position: 21, active: true, nonSporting: true },
        { slug: 'crypto', title: 'Crypto', grouping: 'Crypto', espnPath: '', oddsApiKey: '', position: 22, active: true, nonSporting: true },
      ],
    },
  },

  indexes: [
    { name: 'sports_slug', columns: ['slug'], unique: true },
  ],

  attributes: {
    // Our canonical identifier, used in URLs and API filters: 'nba'.
    slug: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(40) },
      factory: faker => faker.helpers.arrayElement(['nba', 'nfl', 'mlb', 'nhl', 'epl']),
    },
    title: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(80) },
      factory: faker => faker.helpers.arrayElement(['NBA', 'NFL', 'MLB', 'NHL', 'Premier League']),
    },
    // Broad grouping for UI facets: 'Basketball', 'Soccer', 'Politics'.
    grouping: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(60) },
      factory: faker => faker.helpers.arrayElement(['Basketball', 'Football', 'Baseball', 'Hockey', 'Soccer']),
    },
    // ESPN's `{sport}/{league}` scoreboard path segment, '' when unsupported.
    espnPath: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(80) },
      factory: () => 'basketball/nba',
    },
    // The Odds API sport key, '' when unsupported.
    oddsApiKey: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(80) },
      factory: () => 'basketball_nba',
    },
    // Whether the ingestion loop polls this league.
    active: {
      type: 'boolean',
      fillable: true,
      default: true,
      validation: { rule: schema.boolean() },
      factory: () => true,
    },
    // Ordering hint for league switchers.
    position: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: () => 0,
    },
    // True for markets that never have a home/away team (politics, crypto).
    // These skip the ESPN backbone and come from prediction venues only.
    nonSporting: {
      type: 'boolean',
      fillable: true,
      default: false,
      validation: { rule: schema.boolean() },
      factory: () => false,
    },
  },

  hasMany: ['MarketEvent', 'SportsTeam'],
} as const)
