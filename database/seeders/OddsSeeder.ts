import { Database } from 'bun:sqlite'
import process from 'node:process'
import { Seeder } from '@stacksjs/database'

/**
 * Seeds OddsBeacon's sports board: sportsbooks + prediction markets and a
 * spread of games across the NBA, NFL, Premier League, NHL, and MLB, with
 * every book's price on each outcome. One game (NYR/BOS) carries a
 * deliberate cross-book arbitrage. Run with
 * `./buddy db:seed --class=OddsSeeder`.
 *
 * Inserts go straight through Bun's SQLite driver for deterministic ids
 * and exact prices (the model factories produce random data, which is the
 * wrong fit for a curated demo board). Re-running is safe — it wipes the
 * four tables first.
 */

interface SeedBookmaker {
  slug: string
  name: string
  kind: 'sportsbook' | 'prediction'
  accent: string
  short: string
}

interface SeedEvent {
  title: string
  category: string
  league: string
  market: string
  startsAt: string
  updatedMinutesAgo: number
  complete: boolean
  selections: Array<{ label: string, prices: Record<string, number> }>
}

const bookmakers: SeedBookmaker[] = [
  { slug: 'draftkings', name: 'DraftKings', kind: 'sportsbook', accent: 'emerald', short: 'DK' },
  { slug: 'fanduel', name: 'FanDuel', kind: 'sportsbook', accent: 'sky', short: 'FD' },
  { slug: 'betmgm', name: 'BetMGM', kind: 'sportsbook', accent: 'amber', short: 'MGM' },
  { slug: 'caesars', name: 'Caesars', kind: 'sportsbook', accent: 'yellow', short: 'CZR' },
  { slug: 'bet365', name: 'bet365', kind: 'sportsbook', accent: 'green', short: 'B365' },
  { slug: 'pinnacle', name: 'Pinnacle', kind: 'sportsbook', accent: 'orange', short: 'PIN' },
  { slug: 'polymarket', name: 'Polymarket', kind: 'prediction', accent: 'violet', short: 'PM' },
  { slug: 'kalshi', name: 'Kalshi', kind: 'prediction', accent: 'teal', short: 'KAL' },
]

const events: SeedEvent[] = [
  {
    title: 'Los Angeles Lakers vs Boston Celtics',
    category: 'Basketball',
    league: 'NBA',
    market: 'Moneyline',
    startsAt: 'Tonight · 7:30pm ET',
    updatedMinutesAgo: 2,
    complete: true,
    selections: [
      { label: 'Lakers', prices: { draftkings: 2.30, fanduel: 2.28, betmgm: 2.32, caesars: 2.27, bet365: 2.31, pinnacle: 2.36, polymarket: 2.34, kalshi: 2.33 } },
      { label: 'Celtics', prices: { draftkings: 1.66, fanduel: 1.67, betmgm: 1.64, caesars: 1.65, bet365: 1.66, pinnacle: 1.69, polymarket: 1.68, kalshi: 1.67 } },
    ],
  },
  {
    title: 'Golden State Warriors vs Denver Nuggets',
    category: 'Basketball',
    league: 'NBA',
    market: 'Moneyline',
    startsAt: 'Tonight · 10:00pm ET',
    updatedMinutesAgo: 4,
    complete: true,
    selections: [
      { label: 'Warriors', prices: { draftkings: 2.65, fanduel: 2.60, betmgm: 2.70, caesars: 2.62, bet365: 2.68, pinnacle: 2.72 } },
      { label: 'Nuggets', prices: { draftkings: 1.52, fanduel: 1.55, betmgm: 1.50, caesars: 1.53, bet365: 1.51, pinnacle: 1.56 } },
    ],
  },
  {
    title: 'Kansas City Chiefs vs Buffalo Bills',
    category: 'Football',
    league: 'NFL',
    market: 'Moneyline',
    startsAt: 'Sun · 4:25pm ET',
    updatedMinutesAgo: 6,
    complete: true,
    selections: [
      { label: 'Chiefs', prices: { draftkings: 1.91, fanduel: 1.93, betmgm: 1.90, caesars: 1.92, bet365: 1.91, pinnacle: 1.95, polymarket: 1.94 } },
      { label: 'Bills', prices: { draftkings: 1.95, fanduel: 1.92, betmgm: 1.96, caesars: 1.94, bet365: 1.95, pinnacle: 1.98, polymarket: 1.97 } },
    ],
  },
  {
    title: 'San Francisco 49ers vs Philadelphia Eagles',
    category: 'Football',
    league: 'NFL',
    market: 'Moneyline',
    startsAt: 'Sun · 8:20pm ET',
    updatedMinutesAgo: 9,
    complete: true,
    selections: [
      { label: '49ers', prices: { draftkings: 2.10, fanduel: 2.05, betmgm: 2.12, caesars: 2.08, bet365: 2.10, pinnacle: 2.15 } },
      { label: 'Eagles', prices: { draftkings: 1.78, fanduel: 1.80, betmgm: 1.76, caesars: 1.79, bet365: 1.77, pinnacle: 1.82 } },
    ],
  },
  {
    title: 'Manchester City vs Arsenal',
    category: 'Soccer',
    league: 'Premier League',
    market: 'Match result (1X2)',
    startsAt: 'Sat · 12:30pm ET',
    updatedMinutesAgo: 5,
    complete: true,
    selections: [
      { label: 'Man City', prices: { draftkings: 1.80, fanduel: 1.83, betmgm: 1.78, bet365: 1.82, pinnacle: 1.85 } },
      { label: 'Draw', prices: { draftkings: 3.90, fanduel: 3.95, betmgm: 3.80, bet365: 4.00, pinnacle: 4.05 } },
      { label: 'Arsenal', prices: { draftkings: 4.40, fanduel: 4.30, betmgm: 4.50, bet365: 4.35, pinnacle: 4.55 } },
    ],
  },
  {
    title: 'Liverpool vs Chelsea',
    category: 'Soccer',
    league: 'Premier League',
    market: 'Match result (1X2)',
    startsAt: 'Sun · 11:30am ET',
    updatedMinutesAgo: 8,
    complete: true,
    selections: [
      { label: 'Liverpool', prices: { draftkings: 1.95, fanduel: 1.98, betmgm: 1.92, bet365: 1.97, pinnacle: 2.00 } },
      { label: 'Draw', prices: { draftkings: 3.70, fanduel: 3.75, betmgm: 3.65, bet365: 3.80, pinnacle: 3.85 } },
      { label: 'Chelsea', prices: { draftkings: 3.90, fanduel: 3.85, betmgm: 4.00, bet365: 3.95, pinnacle: 4.10 } },
    ],
  },
  {
    title: 'New York Rangers vs Boston Bruins',
    category: 'Hockey',
    league: 'NHL',
    market: 'Moneyline',
    startsAt: 'Tonight · 7:00pm ET',
    updatedMinutesAgo: 1,
    complete: true,
    selections: [
      { label: 'Rangers', prices: { draftkings: 2.05, fanduel: 2.08, betmgm: 2.04, caesars: 2.06, pinnacle: 2.10, polymarket: 2.09, kalshi: 2.07 } },
      { label: 'Bruins', prices: { draftkings: 2.00, fanduel: 1.98, betmgm: 2.02, caesars: 1.99, pinnacle: 2.05, polymarket: 2.12, kalshi: 2.10 } },
    ],
  },
  {
    title: 'Los Angeles Dodgers vs New York Yankees',
    category: 'Baseball',
    league: 'MLB',
    market: 'Moneyline',
    startsAt: 'Tonight · 7:05pm ET',
    updatedMinutesAgo: 11,
    complete: true,
    selections: [
      { label: 'Dodgers', prices: { draftkings: 1.74, fanduel: 1.76, betmgm: 1.72, caesars: 1.75, bet365: 1.73, pinnacle: 1.78 } },
      { label: 'Yankees', prices: { draftkings: 2.18, fanduel: 2.15, betmgm: 2.20, caesars: 2.16, bet365: 2.19, pinnacle: 2.24 } },
    ],
  },
  {
    title: 'Los Angeles Lakers vs Boston Celtics',
    category: 'Basketball',
    league: 'NBA',
    market: 'Spread (-4.5)',
    startsAt: 'Tonight · 7:30pm ET',
    updatedMinutesAgo: 2,
    complete: true,
    selections: [
      { label: 'Lakers -4.5', prices: { draftkings: 1.91, fanduel: 1.93, betmgm: 1.90, caesars: 1.92, bet365: 1.91, pinnacle: 1.95 } },
      { label: 'Celtics +4.5', prices: { draftkings: 1.95, fanduel: 1.92, betmgm: 1.96, caesars: 1.94, bet365: 1.95, pinnacle: 1.98 } },
    ],
  },
  {
    title: 'Los Angeles Lakers vs Boston Celtics',
    category: 'Basketball',
    league: 'NBA',
    market: 'Total (O/U 220.5)',
    startsAt: 'Tonight · 7:30pm ET',
    updatedMinutesAgo: 2,
    complete: true,
    selections: [
      { label: 'Over 220.5', prices: { draftkings: 1.91, fanduel: 1.90, betmgm: 1.92, caesars: 1.91, bet365: 1.90, pinnacle: 1.95 } },
      { label: 'Under 220.5', prices: { draftkings: 1.95, fanduel: 1.96, betmgm: 1.94, caesars: 1.95, bet365: 1.96, pinnacle: 1.98 } },
    ],
  },
  {
    title: 'Kansas City Chiefs vs Buffalo Bills',
    category: 'Football',
    league: 'NFL',
    market: 'Spread (-2.5)',
    startsAt: 'Sun · 4:25pm ET',
    updatedMinutesAgo: 6,
    complete: true,
    selections: [
      { label: 'Chiefs -2.5', prices: { draftkings: 1.91, fanduel: 1.93, betmgm: 1.90, caesars: 1.92, bet365: 1.91, pinnacle: 1.95 } },
      { label: 'Bills +2.5', prices: { draftkings: 1.95, fanduel: 1.92, betmgm: 1.96, caesars: 1.94, bet365: 1.95, pinnacle: 1.98 } },
    ],
  },
  {
    title: 'Kansas City Chiefs vs Buffalo Bills',
    category: 'Football',
    league: 'NFL',
    market: 'Total (O/U 48.5)',
    startsAt: 'Sun · 4:25pm ET',
    updatedMinutesAgo: 6,
    complete: true,
    selections: [
      { label: 'Over 48.5', prices: { draftkings: 1.91, fanduel: 1.90, betmgm: 1.92, caesars: 1.91, bet365: 1.90, pinnacle: 1.95 } },
      { label: 'Under 48.5', prices: { draftkings: 1.95, fanduel: 1.96, betmgm: 1.94, caesars: 1.95, bet365: 1.96, pinnacle: 1.98 } },
    ],
  },
]

function resolveDbPath(): string {
  const configured = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return configured.startsWith('/') ? configured : `${process.cwd()}/${configured}`
}

export default class OddsSeeder extends Seeder {
  async run(): Promise<void> {
    const db = new Database(resolveDbPath())
    const now = '2026-06-28 12:00:00'

    try {
      // Idempotent: wipe the board so re-seeding never duplicates rows.
      db.run('DELETE FROM odds_snapshots')
      db.run('DELETE FROM odds')
      db.run('DELETE FROM selections')
      db.run('DELETE FROM market_events')
      db.run('DELETE FROM bookmakers')

      const bookmakerId = new Map<string, number>()
      const insertBook = db.prepare(
        'INSERT INTO bookmakers (name, slug, kind, accent, short, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      for (const b of bookmakers) {
        const { lastInsertRowid } = insertBook.run(b.name, b.slug, b.kind, b.accent, b.short, now)
        bookmakerId.set(b.slug, Number(lastInsertRowid))
      }

      const insertEvent = db.prepare(
        'INSERT INTO market_events (title, category, league, market, starts_at, updated_minutes_ago, complete, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      const insertSelection = db.prepare(
        'INSERT INTO selections (market_event_id, label, position, created_at) VALUES (?, ?, ?, ?)',
      )
      const insertOdd = db.prepare(
        'INSERT INTO odds (selection_id, bookmaker_id, price, created_at) VALUES (?, ?, ?, ?)',
      )
      const insertSnapshot = db.prepare(
        'INSERT INTO odds_snapshots (selection_id, bookmaker_id, price, captured_at, created_at) VALUES (?, ?, ?, ?, ?)',
      )

      // Seed a short opening→current line-history trail per price so the
      // UI sparklines have data before the first ingest tick. The final
      // point equals the current price; earlier points drift around it.
      const HISTORY_POINTS = 9
      const STEP_MS = 12 * 60 * 1000
      const baseTime = Date.parse('2026-06-28T12:00:00Z')
      const writeHistory = (selectionId: number, bookId: number, current: number) => {
        for (let i = 0; i < HISTORY_POINTS; i++) {
          const isLast = i === HISTORY_POINTS - 1
          const drift = isLast ? 0 : (Math.random() - 0.5) * 0.05
          const price = isLast ? current : Math.max(1.02, Math.round(current * (1 + drift) * 100) / 100)
          const at = new Date(baseTime - (HISTORY_POINTS - 1 - i) * STEP_MS).toISOString()
          insertSnapshot.run(selectionId, bookId, price, at, at)
        }
      }

      for (const event of events) {
        const { lastInsertRowid: eventRowId } = insertEvent.run(
          event.title,
          event.category,
          event.league,
          event.market,
          event.startsAt,
          event.updatedMinutesAgo,
          event.complete ? 1 : 0,
          now,
        )
        const eventId = Number(eventRowId)

        event.selections.forEach((selection, position) => {
          const { lastInsertRowid: selRowId } = insertSelection.run(eventId, selection.label, position, now)
          const selectionId = Number(selRowId)

          for (const [slug, price] of Object.entries(selection.prices)) {
            const bookId = bookmakerId.get(slug)
            if (bookId !== undefined) {
              insertOdd.run(selectionId, bookId, price, now)
              writeHistory(selectionId, bookId, price)
            }
          }
        })
      }

      const counts = {
        bookmakers: bookmakers.length,
        events: events.length,
        selections: events.reduce((n, e) => n + e.selections.length, 0),
      }
      // eslint-disable-next-line no-console
      console.log(`[OddsSeeder] seeded ${counts.bookmakers} bookmakers, ${counts.events} games, ${counts.selections} selections`)
    }
    finally {
      db.close()
    }
  }
}
