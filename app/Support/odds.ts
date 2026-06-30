/**
 * OddsBeacon — odds math + comparison-board assembly.
 *
 * Pure domain logic that turns the rows stored by the Bookmaker /
 * MarketEvent / Selection / Odd models into the view-model the page and
 * the API render: best price per outcome, how much the best line beats
 * the field, and the cross-book hold / arbitrage per market.
 *
 * `loadBoard()` reads straight from the SQLite file with Bun's built-in
 * driver so it works identically inside the API server and inside an STX
 * server-script (which has no ORM in scope) — the same pattern the
 * scaffold's order-confirmation view uses.
 */

import { Database } from 'bun:sqlite'
import process from 'node:process'

export type BookmakerKind = 'sportsbook' | 'prediction'

export interface Bookmaker {
  id: number
  name: string
  slug: string
  kind: BookmakerKind
  accent: string
  short: string
}

export interface Quote {
  bookmakerId: number
  price: number
}

export interface Selection {
  id: number
  label: string
  position: number
  quotes: Quote[]
}

export interface MarketEvent {
  id: number
  title: string
  category: string
  league: string
  market: string
  startsAt: string
  updatedMinutesAgo: number
  complete: boolean
  selections: Selection[]
}

// ----------------------------------------------------------------------------
// Odds math
// ----------------------------------------------------------------------------

/** Probability implied by decimal odds (ignores the book's margin). */
export function impliedProbability(decimal: number): number {
  return 1 / decimal
}

/** Convert decimal odds to American (moneyline) format, e.g. +138 / -145. */
export function toAmerican(decimal: number): string {
  if (decimal >= 2)
    return `+${Math.round((decimal - 1) * 100)}`
  return `${Math.round(-100 / (decimal - 1))}`
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    [a, b] = [b, a % b]
  }
  return a
}

/**
 * Convert decimal odds to traditional fractional odds (e.g. 2.50 → "3/2").
 * Approximates the profit ratio (decimal − 1) with the closest fraction
 * whose denominator is ≤ 20, then reduces it — close enough to the
 * fractions books actually quote without a lookup ladder.
 */
export function toFractional(decimal: number): string {
  const profit = decimal - 1
  if (profit <= 0)
    return '0/1'
  let bestP = Math.round(profit)
  let bestQ = 1
  let bestErr = Math.abs(profit - bestP)
  for (let q = 1; q <= 20; q++) {
    const p = Math.round(profit * q)
    const err = Math.abs(profit - p / q)
    if (err < bestErr - 1e-9) {
      bestP = p
      bestQ = q
      bestErr = err
    }
  }
  const g = gcd(bestP, bestQ) || 1
  return `${bestP / g}/${bestQ / g}`
}

export interface BestQuote {
  bookmakerId: number
  price: number
}

/** Highest decimal odds (best payout for the bettor) for one selection. */
export function bestQuote(selection: Selection): BestQuote | null {
  let best: BestQuote | null = null
  for (const q of selection.quotes) {
    if (best === null || q.price > best.price)
      best = { bookmakerId: q.bookmakerId, price: q.price }
  }
  return best
}

/** Average decimal odds across every book quoting a selection. */
export function averagePrice(selection: Selection): number {
  if (selection.quotes.length === 0)
    return 0
  return selection.quotes.reduce((sum, q) => sum + q.price, 0) / selection.quotes.length
}

export interface MarketHold {
  bestBookSum: number
  /** Positive = unavoidable margin; the lower, the better for bettors. */
  holdPct: number
  /** True when the best prices across books guarantee a profit. */
  isArbitrage: boolean
  /** Guaranteed return when an arbitrage exists (else 0). */
  arbitragePct: number
}

/**
 * "Line shopping" hold: combine the best available price for every
 * selection. When the implied probabilities sum below 1 there is a
 * cross-book arbitrage — a guaranteed profit by splitting the stake.
 */
export function marketHold(event: MarketEvent): MarketHold {
  let sum = 0
  for (const selection of event.selections) {
    const best = bestQuote(selection)
    if (best)
      sum += impliedProbability(best.price)
  }
  return {
    bestBookSum: sum,
    holdPct: (sum - 1) * 100,
    isArbitrage: sum < 1,
    arbitragePct: sum < 1 ? (1 - sum) * 100 : 0,
  }
}

// ----------------------------------------------------------------------------
// View-model assembly
// ----------------------------------------------------------------------------

export interface QuoteCell {
  bookmakerId: number
  price: number | null
  american: string | null
  fractional: string | null
  isBest: boolean
}

export interface SelectionView {
  id: number
  label: string
  bestBookmakerId: number | null
  bestPrice: number | null
  bestAmerican: string | null
  bestFractional: string | null
  bestImpliedPct: number
  average: number
  /** % the best price beats the field average by — the value of shopping. */
  edgeVsAvgPct: number
  /** Recent price history (oldest→newest) for the best book — sparkline data. */
  bestHistory: number[]
  quotes: QuoteCell[]
}

export interface EventView {
  id: number
  title: string
  category: string
  league: string
  market: string
  startsAt: string
  updatedMinutesAgo: number
  complete: boolean
  bookmakerIds: number[]
  selections: SelectionView[]
  hold: MarketHold | null
}

export interface OddsSummary {
  eventCount: number
  bookmakerCount: number
  sportsbookCount: number
  predictionCount: number
  selectionCount: number
  arbitrageCount: number
  /** Average best-vs-field edge across every selection, as a percent. */
  avgEdgePct: number
}

export interface Board {
  bookmakers: Bookmaker[]
  events: EventView[]
  summary: OddsSummary
  categories: string[]
}

function buildEventView(event: MarketEvent, allBookmakers: Bookmaker[]): EventView {
  const order = allBookmakers.map(b => b.id)
  const bookmakerIds = order.filter(id =>
    event.selections.some(s => s.quotes.some(q => q.bookmakerId === id)),
  )

  const selections: SelectionView[] = event.selections.map((selection) => {
    const best = bestQuote(selection)
    const average = averagePrice(selection)
    const byBook = new Map(selection.quotes.map(q => [q.bookmakerId, q.price]))
    return {
      id: selection.id,
      label: selection.label,
      bestBookmakerId: best?.bookmakerId ?? null,
      bestPrice: best?.price ?? null,
      bestAmerican: best ? toAmerican(best.price) : null,
      bestFractional: best ? toFractional(best.price) : null,
      bestImpliedPct: best ? impliedProbability(best.price) * 100 : 0,
      average,
      edgeVsAvgPct: best && average ? (best.price / average - 1) * 100 : 0,
      bestHistory: [],
      quotes: bookmakerIds.map((bookmakerId) => {
        const price = byBook.get(bookmakerId) ?? null
        return {
          bookmakerId,
          price,
          american: price !== null ? toAmerican(price) : null,
          fractional: price !== null ? toFractional(price) : null,
          isBest: best !== null && bookmakerId === best.bookmakerId,
        }
      }),
    }
  })

  return {
    id: event.id,
    title: event.title,
    category: event.category,
    league: event.league,
    market: event.market,
    startsAt: event.startsAt,
    updatedMinutesAgo: event.updatedMinutesAgo,
    complete: event.complete,
    bookmakerIds,
    selections,
    hold: event.complete ? marketHold(event) : null,
  }
}

/** Turn raw model rows into the full comparison board the UI renders. */
export function assembleBoard(events: MarketEvent[], bookmakers: Bookmaker[]): Board {
  const views = events.map(e => buildEventView(e, bookmakers))

  let edgeSum = 0
  let edgeCount = 0
  for (const v of views) {
    for (const s of v.selections) {
      edgeSum += s.edgeVsAvgPct
      edgeCount++
    }
  }

  const summary: OddsSummary = {
    eventCount: events.length,
    bookmakerCount: bookmakers.length,
    sportsbookCount: bookmakers.filter(b => b.kind === 'sportsbook').length,
    predictionCount: bookmakers.filter(b => b.kind === 'prediction').length,
    selectionCount: events.reduce((sum, e) => sum + e.selections.length, 0),
    arbitrageCount: views.filter(v => v.hold?.isArbitrage).length,
    avgEdgePct: edgeCount ? edgeSum / edgeCount : 0,
  }

  const categories = Array.from(new Set(events.map(e => e.category)))

  return { bookmakers, events: views, summary, categories }
}

// ----------------------------------------------------------------------------
// Data access (Bun SQLite)
// ----------------------------------------------------------------------------

function resolveDbPath(): string {
  const configured = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  if (configured.startsWith('/'))
    return configured
  return `${process.cwd()}/${configured}`
}

export interface LineMove {
  selectionId: number
  bookmakerId: number
  pick: string
  game: string
  league: string
  category: string
  book: string
  bookSlug: string
  from: number
  to: number
  dir: 'up' | 'down'
  at: string
}

/**
 * The most recent line moves across all books — the latest price for each
 * (selection, bookmaker) versus the one before it, newest first. Powers
 * the live-action feed; realtime `board:updated` messages extend it on the
 * client.
 */
export function loadRecentMoves(limit = 40, dbPath: string = resolveDbPath()): LineMove[] {
  const db = new Database(dbPath, { readonly: true })
  try {
    const rows = db.query(`
      SELECT os.selection_id, os.bookmaker_id, os.price, os.captured_at,
             s.label AS pick, e.title AS game, e.league AS league, e.category AS category,
             b.name AS book, b.slug AS slug
      FROM odds_snapshots os
      JOIN selections s ON s.id = os.selection_id
      JOIN market_events e ON e.id = s.market_event_id
      JOIN bookmakers b ON b.id = os.bookmaker_id
      ORDER BY os.captured_at DESC, os.id DESC
      LIMIT 6000
    `).all() as Array<Record<string, any>>

    // rows are newest-first; keep the two newest prices per (sel, book).
    const points = new Map<string, Array<{ price: number, at: string, row: Record<string, any> }>>()
    for (const r of rows) {
      const key = `${r.selection_id}:${r.bookmaker_id}`
      const list = points.get(key) ?? []
      if (list.length < 2)
        list.push({ price: r.price, at: r.captured_at, row: r })
      points.set(key, list)
    }

    const moves: LineMove[] = []
    for (const pts of points.values()) {
      if (pts.length < 2 || pts[0].price === pts[1].price)
        continue
      const r = pts[0].row
      moves.push({
        selectionId: r.selection_id,
        bookmakerId: r.bookmaker_id,
        pick: r.pick,
        game: r.game,
        league: r.league,
        category: r.category,
        book: r.book,
        bookSlug: r.slug,
        from: pts[1].price,
        to: pts[0].price,
        dir: pts[0].price > pts[1].price ? 'up' : 'down',
        at: pts[0].at,
      })
    }
    moves.sort((a, b) => (a.at < b.at ? 1 : -1))
    return moves.slice(0, limit)
  }
  finally {
    db.close()
  }
}

/**
 * Load every event, selection, bookmaker, and odd from SQLite and
 * assemble the comparison board. Read-only — safe to call on every
 * request from both the API and SSR.
 */
export function loadBoard(dbPath: string = resolveDbPath()): Board {
  const db = new Database(dbPath, { readonly: true })
  try {
    const bookmakers = db
      .query('SELECT id, name, slug, kind, accent, short FROM bookmakers ORDER BY id ASC')
      .all() as Array<Omit<Bookmaker, 'kind'> & { kind: string }>

    const eventRows = db
      .query('SELECT id, title, category, league, market, starts_at, updated_minutes_ago, complete FROM market_events ORDER BY id ASC')
      .all() as Array<Record<string, unknown>>

    const selectionRows = db
      .query('SELECT id, market_event_id, label, position FROM selections ORDER BY position ASC, id ASC')
      .all() as Array<Record<string, unknown>>

    const oddRows = db
      .query('SELECT selection_id, bookmaker_id, price FROM odds')
      .all() as Array<{ selection_id: number, bookmaker_id: number, price: number }>

    const quotesBySelection = new Map<number, Quote[]>()
    for (const row of oddRows) {
      const list = quotesBySelection.get(row.selection_id) ?? []
      list.push({ bookmakerId: row.bookmaker_id, price: row.price })
      quotesBySelection.set(row.selection_id, list)
    }

    const selectionsByEvent = new Map<number, Selection[]>()
    for (const row of selectionRows) {
      const eventId = row.market_event_id as number
      const list = selectionsByEvent.get(eventId) ?? []
      list.push({
        id: row.id as number,
        label: row.label as string,
        position: (row.position as number) ?? 0,
        quotes: quotesBySelection.get(row.id as number) ?? [],
      })
      selectionsByEvent.set(eventId, list)
    }

    const events: MarketEvent[] = eventRows.map(row => ({
      id: row.id as number,
      title: row.title as string,
      category: row.category as string,
      league: row.league as string,
      market: row.market as string,
      startsAt: row.starts_at as string,
      updatedMinutesAgo: (row.updated_minutes_ago as number) ?? 0,
      complete: Boolean(row.complete),
      selections: selectionsByEvent.get(row.id as number) ?? [],
    }))

    const normalizedBooks: Bookmaker[] = bookmakers.map(b => ({
      ...b,
      kind: b.kind === 'prediction' ? 'prediction' : 'sportsbook',
    }))

    const board = assembleBoard(events, normalizedBooks)

    // Attach the recent price history for each outcome's best book so the
    // UI can draw a sparkline and an open→current delta.
    const historyStmt = db.query(
      'SELECT price FROM odds_snapshots WHERE selection_id = ?1 AND bookmaker_id = ?2 ORDER BY captured_at ASC LIMIT 40',
    )
    for (const ev of board.events) {
      for (const s of ev.selections) {
        if (s.bestBookmakerId != null) {
          const rows = historyStmt.all(s.id, s.bestBookmakerId) as Array<{ price: number }>
          s.bestHistory = rows.map(r => r.price)
        }
      }
    }

    return board
  }
  finally {
    db.close()
  }
}
