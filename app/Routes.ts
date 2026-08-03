import type { RouteDefinition, RouteRegistry } from '@stacksjs/router'

export type { RouteDefinition, RouteRegistry }

/**
 * Route Registry
 *
 * The key becomes the URL prefix unless one is given explicitly.
 *
 * `trading` declares its prefix rather than inheriting the key: the file
 * already namespaces its own paths (`/trading/candidates`), so taking
 * the key as a prefix too would serve them at `/api/trading/trading/…`.
 *
 * @see https://docs.stacksjs.org/routing
 */
export default {
  // Odds board, prediction-market reads, and bet sheets.
  'api': 'api',

  // Strategies, venue accounts, decisions. See routes/trading.ts.
  'trading': { path: 'trading', prefix: '/api' },

  // Subscription checkout and the Stripe webhook. See routes/billing.ts.
  'billing': { path: 'billing', prefix: '/api' },

  'v1': { path: 'v1', prefix: 'v1' },
} satisfies RouteRegistry
