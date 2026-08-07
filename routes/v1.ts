import { route } from '@stacksjs/router'

/**
 * Version 1 of the public API, served under `/api/v1`.
 *
 * The versioned prefix existed before but was empty, so every endpoint
 * lived at an unversioned path and no field could be renamed or removed
 * without breaking whoever was consuming it. Everything of substance now
 * lives here, and the unversioned routes remain as thin aliases so nothing
 * already pointed at them breaks.
 *
 * ### Identity and rate limits
 *
 * Every endpoint here accepts an API key and is metered when one is
 * presented, with a daily quota that follows the plan behind it. A
 * request without a key is still served, under the per-IP throttle it
 * always had — except for the bulk export, which requires one.
 *
 * ### Rate limits
 * Read endpoints are throttled generously — a live board polls, and
 * punishing that would defeat the product. The two expensive endpoints are
 * held tighter: `/training` can return five thousand rows a call, and
 * `/arbitrage` opts out of caching entirely, so both cost real work per
 * request rather than being served from a cache.
 */

route.get('/status', 'Actions/V1/GetStatus')
route.get('/openapi', 'Actions/V1/GetOpenApi')

route.group({ middleware: ['throttle:240,1', 'apikey'] }, () => {
  // The comparison board, filtered and paginated.
  route.get('/odds', 'Actions/V1/GetBoard')

  // One event with every market on it.
  route.get('/events/{id}', 'Actions/V1/GetEvent')

  // What each book *offers* on an event, as opposed to what it is pricing.
  // A book that pulled a market and a book that never had it look
  // identical through the odds; only this separates them.
  route.get('/events/{id}/markets', 'Actions/V1/GetEventMarkets')

  // The board as it stood at an instant, reconstructed from the change
  // log. A paid feed charges roughly ten times a live call for this; it is
  // close to free here because the fair-value model needs the history
  // anyway.
  route.get('/historical/odds', 'Actions/V1/GetHistoricalOdds')

  // Where the best price beats de-vigged fair value.
  route.get('/edges', 'Actions/V1/GetEdges')

  // Recent line moves across every book.
  route.get('/movements', 'Actions/V1/GetMovements')

  // How well the fair-value model's probabilities have held up.
  route.get('/calibration', 'Actions/V1/GetCalibration')
})

// Uncached and computed per request, so it gets its own tighter budget.
route.group({ middleware: ['throttle:60,1', 'apikey'] }, () => {
  route.get('/arbitrage', 'Actions/V1/GetArbitrage')
})

// Bulk export, and the one endpoint that requires a key. Five thousand
// rows a request served to a caller we cannot name is not a rate-limiting
// problem, it is not knowing who has the data or how much of it they
// have. A key answers both and costs a legitimate caller one header.
route.group({ middleware: ['throttle:20,1', 'apikey:required'] }, () => {
  route.get('/training', 'Actions/V1/GetTrainingData')
})

// The same check as `/api/health`. Kept at both paths because a probe
// configured against the versioned prefix should not get a weaker answer
// than one configured against the unversioned one.
route.get('/health', 'Actions/GetHealth')
