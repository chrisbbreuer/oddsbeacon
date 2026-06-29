import { response, route } from '@stacksjs/router'
import { loadBoard } from '../app/Support/odds'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered under the `/api`
 * prefix, so `route.get('/odds', …)` is served at `/api/odds`.
 *
 * @see https://docs.stacksjs.com/routing
 */

// The full comparison board: every market with best lines, edges, and
// per-market hold/arbitrage already computed.
route.get('/odds', () => response.json(loadBoard()))

// Just the markets where line-shopping the best price across books
// yields a guaranteed profit.
route.get('/odds/arbitrage', () => {
  const board = loadBoard()
  return response.json({
    count: board.summary.arbitrageCount,
    events: board.events.filter(e => e.hold?.isArbitrage),
  })
})

// `/coming-soon` is served as an STX view from
// `storage/framework/defaults/resources/views/coming-soon.stx`. The
// view auto-resolves through stx-serve, so no route registration is
// needed here. To activate the holding page across the whole app:
//
//   ./buddy coming-soon [--secret=my-magic-token]
//
// Launch the site with `./buddy launch`. Maintenance mode (503 page,
// distinct cookie + state file) is the separate `./buddy down` /
// `./buddy up` pair.
