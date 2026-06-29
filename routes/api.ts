import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered under the `/api`
 * prefix, so `route.get('/odds', …)` is served at `/api/odds`.
 *
 * The odds endpoints are backed by actions in `app/Actions/Odds/` so the
 * same query logic is reusable from routes, events (realtime broadcasts),
 * and the CLI.
 *
 * @see https://docs.stacksjs.com/routing
 */

// Full board across every bookmaker + market.
route.get('/odds', 'Actions/Odds/GetBoard')

// Cross-book arbitrage opportunities.
route.get('/odds/arbitrage', 'Actions/Odds/GetArbitrage')

// Best available price for every outcome, flattened.
route.get('/odds/best', 'Actions/Odds/GetBestLines')

// One market by id, with the books quoting it.
route.get('/odds/market/{id}', 'Actions/Odds/GetMarket')

// Every price a single bookmaker offers, by slug.
route.get('/odds/book/{slug}', 'Actions/Odds/GetBookmaker')

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
