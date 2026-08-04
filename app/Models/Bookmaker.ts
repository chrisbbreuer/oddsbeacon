import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * Bookmaker — a place that quotes a price on an outcome.
 *
 * Covers both traditional sportsbooks (DraftKings, Pinnacle, …) and
 * prediction markets (Polymarket, Kalshi, …). `kind` keeps the two apart
 * in the UI while their prices are compared in the same grid.
 *
 * ### Why `sharp` and `consensusWeight` matter
 * Books are not interchangeable estimators. Low-margin, high-limit books
 * that welcome winning bettors (Pinnacle, Circa, and the prediction
 * venues, which are pure order books) carry far more information than a
 * recreational book that copies the market and shades toward public
 * money. A flat average across all books is therefore a *worse* estimate
 * of true probability than the sharp price alone.
 *
 * `consensusWeight` is that judgement made explicit and tunable, and
 * `sharp` marks the books the fair-value anchor is drawn from. Both are
 * data rather than code so a book's status can change without a deploy —
 * which it does, when a book tightens or loosens its limits.
 */
export default defineModel({
  name: 'Bookmaker',
  table: 'bookmakers',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    // Reference data. `providerKey` must match the feed's own key exactly
    // or the book's prices are silently dropped, and `consensusWeight`
    // encodes the judgement described in the class note above.
    useSeeder: {
      count: 0,
      fixtures: [
        { slug: 'pinnacle', name: 'Pinnacle', kind: 'sportsbook', providerKey: 'pinnacle', accent: 'orange', short: 'PIN', region: 'eu', sharp: true, consensusWeight: 4, active: true },
        { slug: 'circa', name: 'Circa Sports', kind: 'sportsbook', providerKey: 'circasports', accent: 'red', short: 'CIR', region: 'us', sharp: true, consensusWeight: 3, active: true },
        { slug: 'betonlineag', name: 'BetOnline', kind: 'sportsbook', providerKey: 'betonlineag', accent: 'lime', short: 'BOL', region: 'us', sharp: true, consensusWeight: 2, active: true },
        { slug: 'draftkings', name: 'DraftKings', kind: 'sportsbook', providerKey: 'draftkings', accent: 'emerald', short: 'DK', region: 'us', sharp: false, consensusWeight: 1, active: true },
        { slug: 'fanduel', name: 'FanDuel', kind: 'sportsbook', providerKey: 'fanduel', accent: 'sky', short: 'FD', region: 'us', sharp: false, consensusWeight: 1, active: true },
        { slug: 'betmgm', name: 'BetMGM', kind: 'sportsbook', providerKey: 'betmgm', accent: 'amber', short: 'MGM', region: 'us', sharp: false, consensusWeight: 1, active: true },
        { slug: 'caesars', name: 'Caesars', kind: 'sportsbook', providerKey: 'williamhill_us', accent: 'yellow', short: 'CZR', region: 'us', sharp: false, consensusWeight: 1, active: true },
        { slug: 'bet365', name: 'bet365', kind: 'sportsbook', providerKey: 'bet365', accent: 'green', short: 'B365', region: 'uk', sharp: false, consensusWeight: 1.5, active: true },
        { slug: 'betfair', name: 'Betfair Exchange', kind: 'sportsbook', providerKey: 'betfair_ex_uk', accent: 'fuchsia', short: 'BF', region: 'uk', sharp: true, consensusWeight: 3.5, active: true },
        // Order books rather than bookmakers: no margin to remove, and the
        // price is a traded probability, so they anchor fair value well.
        { slug: 'polymarket', name: 'Polymarket', kind: 'prediction', providerKey: 'polymarket', accent: 'violet', short: 'PM', region: 'global', sharp: true, consensusWeight: 3, active: true },
        { slug: 'kalshi', name: 'Kalshi', kind: 'prediction', providerKey: 'kalshi', accent: 'teal', short: 'KAL', region: 'us', sharp: true, consensusWeight: 3, active: true },
      ],
    },
  },

  indexes: [
    { name: 'bookmakers_slug', columns: ['slug'], unique: true },
  ],

  attributes: {
    name: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(100) },
      factory: faker => faker.company.name(),
    },
    slug: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(100) },
      factory: faker => faker.lorem.slug(),
    },
    // 'sportsbook' | 'prediction'
    kind: {
      type: 'string',
      required: true,
      fillable: true,
      default: 'sportsbook',
      validation: { rule: schema.enum(['sportsbook', 'prediction']) },
      factory: faker => faker.helpers.arrayElement(['sportsbook', 'prediction']),
    },
    // crosswind color token used for the book's badge
    accent: {
      type: 'string',
      fillable: true,
      default: 'slate',
      validation: { rule: schema.string().max(40) },
      factory: () => 'slate',
    },
    // short mark for compact column headers, e.g. "DK", "PIN"
    short: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(8) },
      factory: faker => faker.string.alpha({ length: 3, casing: 'upper' }),
    },
    // Key the odds feed knows this book by, for provider→row matching.
    // Explicit because feed keys ('betmgm') differ from our slugs.
    providerKey: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(80) },
      factory: faker => faker.lorem.slug(),
    },
    // Regulatory region the quotes come from: 'us' | 'us2' | 'uk' | 'eu' | 'au'
    region: {
      type: 'string',
      fillable: true,
      default: 'us',
      validation: { rule: schema.string().max(10) },
      factory: () => 'us',
    },
    // Low margin, high limits, tolerates winners — a price worth anchoring
    // fair value to. See the class note.
    sharp: {
      type: 'boolean',
      fillable: true,
      default: false,
      validation: { rule: schema.boolean() },
      factory: () => false,
    },
    // Relative trust in this book's price when blending a consensus.
    // 1.0 is the default; sharp books sit well above it.
    consensusWeight: {
      type: 'number',
      fillable: true,
      default: 1,
      validation: { rule: schema.float().min(0).max(10) },
      factory: () => 1,
    },
    active: {
      type: 'boolean',
      fillable: true,
      default: true,
      validation: { rule: schema.boolean() },
      factory: () => true,
    },
    url: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(200) },
      factory: () => '',
    },
    lastSeenAt: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(40) },
      factory: () => '',
    },
  },

  hasMany: ['Odd', 'OddsSnapshot', 'ClosingLine'],
} as const)
