import type { Database } from '../../Support/db'
import type { FeedEvent, OddsProvider } from '../odds/provider'
import type { PriceWrite } from './prices'
import process from 'node:process'
import { SyntheticProvider } from '../odds/synthetic'
import { TheOddsApiProvider } from '../odds/the-odds-api'
import { loadBookmakerIndex, writePrices } from './prices'
import { loadSports, resolveEvent, resolveMarket, resolveSelection, resolveTeam } from './resolve'
import { IngestRunTracker } from './run'

/**
 * Persist a normalized odds feed.
 *
 * The whole pass runs in one transaction. Ingestion touches thousands of
 * rows across five tables, and a half-applied pass is worse than a skipped
 * one: markets without selections, or selections whose prices never
 * arrived, read downstream as "this market has no line" rather than as an
 * error.
 */

/** Human labels for the bet types, so the UI needs no lookup table. */
const MARKET_LABELS: Record<string, string> = {
  h2h: 'Moneyline',
  spreads: 'Spread',
  totals: 'Total',
}

/**
 * Pick the active provider: the real feed when `ODDS_API_KEY` is set,
 * otherwise the simulator over real fixtures.
 *
 * The fallback is recorded loudly in the run row rather than hidden. A
 * synthetic board that looks live is exactly how the previous system
 * concealed a feed that had never matched anything.
 */
export async function resolveProvider(db: Database): Promise<OddsProvider> {
  const key = process.env.ODDS_API_KEY
  if (!key)
    return new SyntheticProvider(db)

  const sports = (await loadSports(db)).filter(s => s.odds_api_key)
  return new TheOddsApiProvider(key, sports)
}

export interface OddsIngestResult {
  provider: string
  status: string
  events: number
  markets: number
  selections: number
  pricesWritten: number
  pricesChanged: number
  snapshots: number
  unmatched: number
  quotaRemaining: number
  errors: string[]
}

export async function ingestOdds(db: Database, provider?: OddsProvider): Promise<OddsIngestResult> {
  const active = provider ?? await resolveProvider(db)
  const tracker = new IngestRunTracker(db, active.name, 'odds')
  await tracker.start()

  let feed: FeedEvent[] = []
  try {
    feed = await active.fetchEvents(tracker)
  }
  catch (err) {
    tracker.fail(err instanceof Error ? err.message : String(err))
  }

  const bookIndex = await loadBookmakerIndex(db)
  const sportBySlug = new Map((await loadSports(db)).map(s => [s.slug, s]))

  let markets = 0
  let selections = 0
  const writes: PriceWrite[] = []

  try {
    const result = await db.transaction(async (transaction) => {
      for (const event of feed) {
      const sport = sportBySlug.get(event.sportSlug)
      if (!sport) {
        tracker.unmatchedCount++
        continue
      }

        const homeTeamId = await resolveTeam(transaction, sport.id, event.homeTeam)
        const awayTeamId = await resolveTeam(transaction, sport.id, event.awayTeam)

        const { eventId } = await resolveEvent(transaction, {
        sportId: sport.id,
        provider: active.name,
        externalId: event.externalId,
        title: `${event.awayTeam} at ${event.homeTeam}`,
        commenceAt: event.commenceAt,
        homeTeamId,
        awayTeamId,
        category: sport.grouping,
        league: sport.title,
      })

      for (const book of event.books) {
        const bookmakerId = bookIndex.get(book.key.toLowerCase().replace(/[^a-z0-9]/g, ''))
        if (bookmakerId === undefined) {
          // A book we do not carry. Counted rather than logged per row —
          // an unseeded book produces one of these per event per pass, and
          // the count makes the gap visible without the noise.
          tracker.unmatchedCount++
          continue
        }

        for (const market of book.markets) {
          const marketId = await resolveMarket(transaction, {
            eventId,
            marketType: market.marketType,
            line: market.line,
            period: market.period ?? 'full_game',
            label: MARKET_LABELS[market.marketType] ?? market.marketType,
            // Two- and three-way markets partition the outcome space;
            // anything else may not, and only a complete market has a
            // meaningful hold or arbitrage reading.
            complete: market.outcomes.length >= 2,
          })
          markets++

          for (const [index, outcome] of market.outcomes.entries()) {
            const selectionId = await resolveSelection(transaction, {
              marketId,
              label: outcome.label,
              side: outcome.side,
              point: outcome.point,
              position: index,
              sportsTeamId: outcome.side === 'home' ? homeTeamId : (outcome.side === 'away' ? awayTeamId : null),
            })
            selections++

            writes.push({
              selectionId,
              bookmakerId,
              price: outcome.price,
              point: outcome.point,
              limitAmount: outcome.limitAmount,
              observedAt: book.lastUpdate,
            })
            tracker.rowsRead++
          }
        }
      }
      }

      return await writePrices(transaction, writes)
    })
    tracker.rowsWritten = result.written

    const summary = `${feed.length} events · ${markets} markets · ${result.written} prices (${result.changed} moved)`
    const { status, errors } = await tracker.finish(summary)

    return {
      provider: active.name,
      status,
      events: feed.length,
      markets,
      selections,
      pricesWritten: result.written,
      pricesChanged: result.changed,
      snapshots: result.snapshots,
      unmatched: tracker.unmatchedCount,
      quotaRemaining: tracker.quotaRemaining,
      errors,
    }
  }
  catch (err) {
    tracker.fail(err instanceof Error ? err.message : String(err))
    const { status, errors } = await tracker.finish('failed')
    return {
      provider: active.name,
      status,
      events: feed.length,
      markets: 0,
      selections: 0,
      pricesWritten: 0,
      pricesChanged: 0,
      snapshots: 0,
      unmatched: tracker.unmatchedCount,
      quotaRemaining: tracker.quotaRemaining,
      errors,
    }
  }
}
