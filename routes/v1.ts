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
 * ### Rate limits
 * Read endpoints are throttled generously — a live board polls, and
 * punishing that would defeat the product. The two expensive endpoints are
 * held tighter: `/training` can return five thousand rows a call, and
 * `/arbitrage` opts out of caching entirely, so both cost real work per
 * request rather than being served from a cache.
 */

route.get('/status', 'Actions/V1/GetStatus')
route.get('/openapi', 'Actions/V1/GetOpenApi')

route.group({ middleware: ['throttle:240,1'] }, () => {
  // The comparison board, filtered and paginated.
  route.get('/odds', 'Actions/V1/GetBoard')

  // One event with every market on it.
  route.get('/events/{id}', 'Actions/V1/GetEvent')

  // Where the best price beats de-vigged fair value.
  route.get('/edges', 'Actions/V1/GetEdges')

  // Recent line moves across every book.
  route.get('/movements', 'Actions/V1/GetMovements')

  // How well the fair-value model's probabilities have held up.
  route.get('/calibration', 'Actions/V1/GetCalibration')
})

// Uncached and computed per request, so it gets its own tighter budget.
route.group({ middleware: ['throttle:60,1'] }, () => {
  route.get('/arbitrage', 'Actions/V1/GetArbitrage')
})

// Bulk export. Tighter still: a caller paging through the whole history at
// five thousand rows a request should be doing so deliberately.
route.group({ middleware: ['throttle:20,1'] }, () => {
  route.get('/training', 'Actions/V1/GetTrainingData')
})

// The same check as `/api/health`. Kept at both paths because a probe
// configured against the versioned prefix should not get a weaker answer
// than one configured against the unversioned one.
route.get('/health', 'Actions/GetHealth')
