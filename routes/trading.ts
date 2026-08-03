import { route } from '@stacksjs/router'

/**
 * Trading routes, served under `/api`.
 *
 * Two groups, split by what they can cause:
 *
 *   Read — candidates and the decision feed. Nothing is persisted and no
 *          venue is contacted, so these are safe to poll and safe to
 *          show before a user has connected anything.
 *   Write — strategies, venue accounts, and reviews. All authenticated,
 *          all subject to the plan entitlement checked inside the action
 *          rather than at the route, because the answer differs per
 *          field (a Signal user may save a strategy but not arm it).
 *
 * @see app/Services/trading/ for the engine these sit in front of.
 */

// What the engine is looking at right now, computed live from the tape.
route.get('/trading/candidates', 'Actions/Trading/GetCandidates')

// The decision feed, each row carrying the evidence that produced it.
route.get('/trading/decisions', 'Actions/Trading/GetDecisions')

route.group({ middleware: ['auth'] }, () => {
  route.get('/trading/strategies', 'Actions/Trading/GetStrategies')
  route.post('/trading/strategies', 'Actions/Trading/SaveStrategy')

  // Connecting an account verifies the credentials against the venue
  // before it stores them as usable.
  route.post('/trading/accounts', 'Actions/Trading/ConnectExchangeAccount')

  // Manual approval — the path a strategy left on manual, or a plan
  // without automated execution, queues decisions into.
  route.post('/trading/decisions/{id}/review', 'Actions/Trading/ReviewDecision')
})
