import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * MarketEvent — something with an uncertain outcome that books price up.
 *
 * A game (Lakers vs Celtics), a match (1X2), or a prediction-market
 * question (BTC above $150k? 2028 winner?). Named `MarketEvent` rather
 * than `Event` to avoid colliding with the framework event system.
 */
export default defineModel({
  name: 'MarketEvent',
  table: 'market_events',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  attributes: {
    title: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().min(1).max(200) },
      factory: faker => `${faker.location.city()} vs ${faker.location.city()}`,
    },
    // Basketball | Soccer | Football | Politics | Crypto
    category: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().min(1).max(40) },
      factory: faker => faker.helpers.arrayElement(['Basketball', 'Soccer', 'Football', 'Politics', 'Crypto']),
    },
    league: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().max(60) },
      factory: faker => faker.helpers.arrayElement(['NBA', 'NFL', 'Premier League', 'US Politics', 'Crypto']),
    },
    // Market type label: "Moneyline", "Match result (1X2)", "Yes / No"
    market: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().max(60) },
      factory: () => 'Moneyline',
    },
    startsAt: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().max(60) },
      factory: () => 'Tonight · 7:30pm ET',
    },
    updatedMinutesAgo: {
      type: 'number',
      fillable: true,
      validation: { rule: schema.number().min(0) },
      factory: faker => faker.number.int({ min: 1, max: 30 }),
    },
    // Whether the selections are mutually exclusive AND exhaustive.
    // Only complete markets get a meaningful hold / arbitrage reading.
    complete: {
      type: 'boolean',
      fillable: true,
      validation: { rule: schema.boolean() },
      factory: () => true,
    },
  },

  hasMany: ['Selection'],
} as const)
