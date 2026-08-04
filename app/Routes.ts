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

  // Social sign-in. Under /api like every other route file: the stx page
  // server owns the document root and answers unknown root paths with its
  // own 404 page, so a root-level route here is shadowed before the API
  // router ever sees it. Providers accept any callback URL, so the prefix
  // costs nothing beyond registering the fuller path with them.
  'auth': { path: 'auth', prefix: '/api' },

  // The versioned public API. Served under /api/v1 rather than /v1: the
  // stx page server owns the document root and answers unknown root paths
  // with its own 404, so a root-level prefix is shadowed before the API
  // router sees it — the same reason `auth` carries the /api prefix.
  'v1': { path: 'v1', prefix: '/api/v1' },
} satisfies RouteRegistry
