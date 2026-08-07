import type { BookTransport } from '../../../../config/odds'
import type { SportRow } from '../../ingest/resolve'
import type { IngestRunTracker } from '../../ingest/run'
import type { FeedEvent } from '../provider'

/**
 * What a single bookmaker's adapter has to provide.
 *
 * One adapter per book, each reading that book's own public endpoints and
 * translating into the shared {@link FeedEvent} shape. The shape is the
 * contract: an adapter's whole job is translation, and everything else —
 * identity resolution, price writing, history — is already built and
 * shared.
 *
 * ### What an adapter must not do
 *
 * **It must not resolve identity.** An adapter never looks up our event,
 * team, market, or selection ids. It reports what the book said, keyed by
 * the book's own ids, and `app/Services/ingest/resolve.ts` decides what
 * those refer to. That module exists because the previous ingestion
 * matched on normalized labels and silently attached prices to the wrong
 * games; letting fourteen adapters each re-invent matching would
 * reintroduce that failure fourteen times over.
 *
 * **It must not swallow its errors.** A book that returns nothing and a
 * book that returns an empty list are different facts, and only the first
 * is a problem. Report failures through `ctx.tracker.fail`, which is what
 * turns a broken adapter into a `partial` run instead of a quiet board.
 *
 * **It must not fetch directly.** Use `ctx.fetch`, which spends this
 * book's own rate-limit budget and applies conditional-request headers.
 * A bare `fetch` bypasses the token bucket, and one adapter retrying hard
 * on a bad afternoon is exactly how the other thirteen get starved — or
 * how all fourteen get the shared IP blocked.
 */

/** A book's identity for one already-known event, for per-event reads. */
export interface EventRef {
  /** Our own event id, for correlation on the way back. */
  marketEventId: number
  sportSlug: string
  commenceAt: string
  homeTeam: string
  awayTeam: string
  /** This book's id for the event, when a previous pass recorded one. */
  externalId?: string
}

/** Everything an adapter is allowed to reach the outside world with. */
export interface BookContext {
  /**
   * Provenance for this pass. Adapters increment `requestCount` and call
   * `fail` with a message naming the league, so a partial outage reads as
   * "pinnacle: nfl timed out" rather than as a thin board.
   */
  tracker: IngestRunTracker

  /**
   * Budgeted GET. Resolves `null` on a transport failure after retries,
   * and returns the response otherwise — including error statuses, which
   * the adapter should inspect rather than assume away.
   *
   * Waits on this book's token bucket before going out, so the call site
   * needs no rate-limiting logic of its own.
   */
  fetch: (url: string, init?: { headers?: Record<string, string>, timeoutMs?: number }) => Promise<Response | null>

  /** Cancels in-flight work when the engine is shutting down. */
  signal?: AbortSignal
}

/** A live subscription, closed by the engine on shutdown or reconfiguration. */
export interface Subscription {
  close: () => void
}

export interface BookAdapter {
  /** Must match a `Bookmaker.slug`, or this book's prices cannot be stored. */
  readonly slug: string

  /**
   * An exchange quotes two-sided and publishes depth; a sportsbook quotes
   * one side and publishes nothing. The distinction drives whether lay
   * prices and traded volume are expected, so it is declared rather than
   * inferred from whether they happened to appear.
   */
  readonly kind: 'sportsbook' | 'exchange'

  readonly transport: BookTransport

  /** Our sport slugs this adapter covers. Anything else is not offered. */
  readonly sports: string[]

  /** Every event this book is quoting in one league. */
  fetchSport: (sport: SportRow, ctx: BookContext) => Promise<FeedEvent[]>

  /**
   * One event in depth — player props and alternate lines, which the
   * league-wide listing usually omits. Optional: a book that returns
   * everything up front does not need it.
   */
  fetchEvent?: (event: EventRef, ctx: BookContext) => Promise<FeedEvent | null>

  /**
   * Push updates, for books that publish a socket.
   *
   * The engine skips polling any event a live subscription covers, so an
   * adapter that implements this both lowers request volume and lands
   * changes in milliseconds instead of seconds. Each book's protocol is
   * bespoke, which is why this is optional rather than assumed.
   */
  subscribe?: (ctx: BookContext, onChange: (event: FeedEvent) => void) => Subscription
}

/** Adapters that cover a given league. */
export function adaptersForSport(adapters: BookAdapter[], sportSlug: string): BookAdapter[] {
  return adapters.filter(adapter => adapter.sports.includes(sportSlug))
}
