import type { BookAdapter } from './adapter'
import { enabledBooks } from '../../../../config/odds'

/**
 * The adapter registry.
 *
 * ### Why this is empty
 *
 * Every adapter has to be written against the book's actual response, and
 * that response can only be obtained by making the request. Writing one
 * from an assumed payload shape produces a file that looks finished, has
 * tests that pass against the assumption, and fails on first contact — the
 * worst of the three possible states, because it claims coverage we do not
 * have.
 *
 * So adapters land here one at a time as their real payloads are captured,
 * each with a recorded fixture in `tests/unit/`. Everything they plug into
 * — the contract in `adapter.ts`, the aggregation in `native.ts`, the
 * fallback in `composite.ts`, the budgeted context in `context.ts`, and the
 * loop in `engine.ts` — is built and tested against fakes already.
 *
 * The engine handles an empty registry correctly: `refreshSchedule` skips
 * any league no adapter covers, so it schedules nothing and polls nothing
 * rather than looping on an empty fetch.
 */
const ADAPTERS: BookAdapter[] = []

/**
 * Adapters that are both written and switched on.
 *
 * Two gates, and they answer different questions. Being in `ADAPTERS`
 * means the code exists; being in `enabledBooks()` means we currently want
 * to poll it. Keeping them apart is what lets a misbehaving book be turned
 * off through `ODDS_BOOKS_DISABLED` without deleting its adapter.
 */
export function activeAdapters(): BookAdapter[] {
  const enabled = new Set(enabledBooks().map(book => book.slug))
  return ADAPTERS.filter(adapter => enabled.has(adapter.slug))
}

/** Every adapter that exists, enabled or not. Used by preflight. */
export function allAdapters(): BookAdapter[] {
  return [...ADAPTERS]
}

/**
 * Books configured with a budget but with no adapter written yet.
 *
 * Surfaced rather than inferred: a book enabled in config with no adapter
 * behind it is silently absent from the board, which looks exactly like a
 * book that had nothing to quote.
 */
export function booksWithoutAdapters(): string[] {
  const written = new Set(ADAPTERS.map(adapter => adapter.slug))
  return enabledBooks()
    .map(book => book.slug)
    .filter(slug => !written.has(slug))
}
