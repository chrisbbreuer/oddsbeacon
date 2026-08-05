import type { Database } from '../../Support/db'
import type { IngestRunTracker } from '../ingest/run'
import type { FeedBook, FeedEvent, FeedMarket, OddsProvider } from './provider'
import { decimalFromProbability } from '../../Support/keys'

/**
 * A simulated price feed over **real** events.
 *
 * Runs when `ODDS_API_KEY` is unset, so the ingest → de-vig → board
 * pipeline is exercisable without a paid key. It reads the fixtures ESPN
 * already ingested and invents prices for them; it never invents games.
 *
 * ### Why it models vig rather than jittering numbers
 * The previous synthetic provider multiplied each stored price by a small
 * random drift. That produces movement but not a *market*: the prices on
 * the two sides of an event drift independently, so their implied
 * probabilities sum to an arbitrary number that wanders above and below
 * 100%. Anything downstream that removes margin or looks for arbitrage
 * would then be reading pure noise, and — worse — would appear to work,
 * because arbitrage shows up constantly in random data.
 *
 * So this builds each market the way a book does. It picks a true
 * probability per event, applies a per-book margin, and adds a small
 * per-book opinion. The result has realistic overrounds, sharp books
 * genuinely closer to the truth, and arbitrage that is rare and real
 * rather than constant and fake — which is the only way testing the
 * de-vig layer against it means anything.
 *
 * Every price is tagged synthetic through the run row, so no caller can
 * mistake this for a live feed.
 */
export class SyntheticProvider implements OddsProvider {
  readonly name = 'synthetic'

  constructor(private readonly db: Database) {}

  async fetchEvents(tracker: IngestRunTracker): Promise<FeedEvent[]> {
    const events = await this.db.query<{
      id: number
      title: string
      commence_at: string
      sport_slug: string
      grouping: string
      home_name: string | null
      away_name: string | null
    }>(`
      SELECT e.id, e.title, e.commence_at, s.slug AS sport_slug, s.grouping,
            home.name AS home_name, away.name AS away_name
      FROM market_events e
      JOIN sports s ON s.id = e.sport_id
      LEFT JOIN sports_teams home ON home.id = e.home_sports_team_id
      LEFT JOIN sports_teams away ON away.id = e.away_sports_team_id
      WHERE e.status IN ('scheduled', 'live')
      ORDER BY e.commence_at ASC
      LIMIT 120
    `).all()

    const books = await this.db.query<{ slug: string, name: string, kind: string, sharp: number }>(`
      SELECT slug, name, kind, sharp FROM bookmakers WHERE active = 1 ORDER BY id ASC
    `).all()

    tracker.rowsRead += events.length

    const out: FeedEvent[] = []
    for (const event of events) {
      const homeTeam = event.home_name ?? 'Home'
      const awayTeam = event.away_name ?? 'Away'

      // A stable "true" probability per event, so successive passes move
      // prices around a fixed truth instead of re-rolling it — that is
      // what makes the accumulated line history mean anything.
      const trueHome = 0.30 + (hash(`${event.id}:home`) % 1000) / 1000 * 0.40
      const totalLine = event.grouping === 'Basketball' ? 220.5 : (event.grouping === 'Baseball' ? 8.5 : 44.5)
      const spreadLine = Math.round((0.5 - trueHome) * 20) / 2

      const feedBooks: FeedBook[] = []
      for (const book of books) {
        // Prediction venues are order books: no margin to add. Sharp books
        // run thin; recreational books run fat. These are the real orders
        // of magnitude and they are what makes de-vig testable.
        const margin = book.kind === 'prediction' ? 0.002 : (book.sharp ? 0.022 : 0.052)
        // How far this book's opinion sits from the truth. Sharp books
        // are tighter, which is the property `consensusWeight` exists to
        // exploit — a consensus that ignored it would be worse than the
        // sharp price alone.
        const spread = book.sharp ? 0.008 : 0.022
        const drift = (noise(`${event.id}:${book.slug}:${tickSeed()}`) - 0.5) * spread

        const markets: FeedMarket[] = [
          priceTwoWay('h2h', null, clamp(trueHome + drift), margin, homeTeam, awayTeam, null, null),
          priceTwoWay('spreads', spreadLine, clamp(0.5 + drift * 0.6), margin, homeTeam, awayTeam, spreadLine, -spreadLine),
          priceTwoWay('totals', totalLine, clamp(0.5 + drift * 0.5), margin, 'Over', 'Under', totalLine, totalLine, 'over', 'under'),
        ]

        feedBooks.push({
          key: book.slug,
          title: book.name,
          lastUpdate: new Date().toISOString(),
          markets,
        })
      }

      out.push({
        externalId: `synthetic-${event.id}`,
        sportSlug: event.sport_slug,
        commenceAt: event.commence_at,
        homeTeam,
        awayTeam,
        books: feedBooks,
      })
    }

    return out
  }
}

/**
 * Build a two-way market from a true probability and a margin.
 *
 * The margin is split evenly across both sides, so the implied
 * probabilities sum to `1 + margin` — exactly the structure a real book
 * quotes, and exactly what the de-vig layer has to undo.
 */
function priceTwoWay(
  marketType: string,
  line: number | null,
  probA: number,
  margin: number,
  labelA: string,
  labelB: string,
  pointA: number | null,
  pointB: number | null,
  sideA = 'home',
  sideB = 'away',
): FeedMarket {
  const probB = 1 - probA
  const overround = 1 + margin

  return {
    marketType,
    line,
    period: 'full_game',
    outcomes: [
      {
        side: sideA,
        label: labelA,
        point: pointA,
        price: round2(decimalFromProbability(probA * overround)),
      },
      {
        side: sideB,
        label: labelB,
        point: pointB,
        price: round2(decimalFromProbability(probB * overround)),
      },
    ],
  }
}

function clamp(p: number): number {
  return Math.min(0.95, Math.max(0.05, p))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Deterministic 32-bit hash, so a given key always yields a given value. */
function hash(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/** Deterministic 0..1 from a key. */
function noise(key: string): number {
  return (hash(key) % 10_000) / 10_000
}

/**
 * A seed that changes every few minutes.
 *
 * Prices should move between passes but not on every call within a pass,
 * so the seed is quantized rather than taken from the clock directly.
 */
function tickSeed(): number {
  return Math.floor(Date.now() / (5 * 60_000))
}
