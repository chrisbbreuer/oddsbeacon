import type { BookBudget } from '../../../config/odds'
import type { IngestRunTracker } from '../ingest/run'
import type { BookAdapter, BookContext } from './books/adapter'
import { conditionalFetch, RateLimiter, ScraperCache } from 'ts-web-scraper'
import { enabledBooks } from '../../../config/odds'

/**
 * The one way an adapter is allowed to reach a bookmaker.
 *
 * Two things are enforced here rather than left to fourteen adapters to
 * remember.
 *
 * **A budget per book, not a budget in total.** Each book gets its own
 * token bucket sized from `config/odds.ts`. A single shared limiter would
 * let one adapter retrying hard against a book having a bad afternoon
 * starve the other thirteen; separate buckets mean a struggling book slows
 * only itself.
 *
 * **Conditional requests.** Every GET carries `If-None-Match` /
 * `If-Modified-Since` from the cached validator, so an unchanged league
 * costs a `304` rather than a full re-download. At one pass every five
 * minutes that was a nicety. At one pass a second across fourteen books it
 * is the difference between a feed and an abuse complaint.
 *
 * Both come from `ts-web-scraper`, which is also where the conditional
 * request support was added for this — rather than reimplemented here.
 */

/** Buckets and caches live for the process, not for the pass. */
const limiters = new Map<string, RateLimiter>()
const caches = new Map<string, ScraperCache>()

function limiterFor(book: BookBudget): RateLimiter {
  const existing = limiters.get(book.slug)
  if (existing)
    return existing

  const limiter = new RateLimiter({
    requestsPerSecond: book.requestsPerSecond,
    // A small burst absorbs the shape of a real pass — several leagues
    // requested back to back — without raising the sustained rate.
    burstSize: Math.max(1, Math.ceil(book.requestsPerSecond)),
  })

  limiters.set(book.slug, limiter)
  return limiter
}

function cacheFor(book: BookBudget): ScraperCache {
  const existing = caches.get(book.slug)
  if (existing)
    return existing

  const cache = new ScraperCache({
    enabled: true,
    // Deliberately short. The cache is here to hold *validators* so a poll
    // can be conditional, not to serve stale prices — a TTL longer than
    // the fastest cadence would answer a live poll from memory and the
    // board would stop moving.
    ttl: 500,
    maxSize: 2_000,
  })

  caches.set(book.slug, cache)
  return cache
}

/**
 * The default user agent.
 *
 * Named rather than disguised. A book that would rather we did not read
 * its endpoint should be able to tell that we are, and to say so.
 */
const USER_AGENT = process.env.ODDS_USER_AGENT
  || 'PredictHQ/1.0 (+https://predicthq.com; odds aggregation)'

export function bookContextFor(
  adapter: BookAdapter,
  tracker: IngestRunTracker,
  signal?: AbortSignal,
): BookContext {
  const budget = enabledBooks().find(book => book.slug === adapter.slug)

  const limiter = budget ? limiterFor(budget) : null
  const cache = budget ? cacheFor(budget) : null

  return {
    tracker,
    signal,

    async fetch(url, init = {}) {
      // Wait for the book's own budget before anything leaves the process.
      await limiter?.throttle()

      tracker.requestCount++

      try {
        const result = await conditionalFetch(url, {
          cache: cache ?? undefined,
          headers: { 'accept': 'application/json', 'user-agent': USER_AGENT, ...init.headers },
          timeout: init.timeoutMs ?? 12_000,
          signal,
          useFresh: false,
        })

        // Reconstitute a Response so adapters have one shape to handle,
        // whether the body came off the wire or out of the cache after a
        // 304. The status is reported honestly rather than normalised to
        // 200, so an adapter can skip re-parsing an unchanged payload.
        return new Response(result.body, {
          status: result.notModified ? 304 : result.status,
          headers: result.headers,
        })
      }
      catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        tracker.fail(`${adapter.slug}: ${reason}`)
        return null
      }
    },
  }
}
