import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * ApiUsage — how much a key used, by day and endpoint.
 *
 * Aggregated on write rather than logged per request. A row per call
 * would be the more flexible record and it would also be the largest
 * table in the database within a week, on a product whose whole API is a
 * board that clients poll. Day and endpoint are the two axes anyone
 * actually groups by — quota enforcement needs the first, and "what is
 * this caller doing" needs the second.
 */
export default defineModel({
  name: 'ApiUsage',
  table: 'api_usage',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
  },

  indexes: [
    // The counter's own lookup, and the one a quota check runs on every
    // request. Unique so two concurrent requests cannot each create a
    // bucket and split the day's count between them.
    { name: 'bucket', columns: ['apiKeyId', 'day', 'endpoint'], unique: true },
    { name: 'day', columns: ['day'] },
  ],

  attributes: {
    apiKeyId: {
      type: 'number',
      fillable: true,
      validation: { rule: schema.number().min(1) },
      factory: faker => faker.number.int({ min: 1, max: 100 }),
    },
    // UTC calendar day, as YYYY-MM-DD. A quota that reset on the
    // server's local midnight would move twice a year.
    day: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().min(10).max(10) },
      factory: () => new Date().toISOString().slice(0, 10),
    },
    // The route pattern, not the resolved path: `/api/v1/events/{id}`
    // rather than one bucket per event ever requested.
    endpoint: {
      type: 'string',
      fillable: true,
      validation: { rule: schema.string().min(1).max(120) },
      factory: () => '/api/v1/odds',
    },
    requests: {
      type: 'number',
      fillable: false,
      validation: { rule: schema.number().min(0) },
      factory: () => 0,
    },
  },
} as const)
