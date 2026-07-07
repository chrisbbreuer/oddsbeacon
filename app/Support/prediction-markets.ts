import { Database } from 'bun:sqlite'
import process from 'node:process'

function dbPath(): string {
  const p = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return p.startsWith('/') ? p : `${process.cwd()}/${p}`
}

/** Traders need this many scored fills before ranking as smart money. */
const MIN_RESOLVED = 2

export interface SmartTrader {
  id: number
  venue: string
  wallet: string
  alias: string
  tradeCount: number
  totalNotional: number
  avgTradeSize: number
  maxTradeSize: number
  resolvedTradeCount: number
  winningTradeCount: number
  winRate: number
  smartScore: number
  isWhale: boolean
}

export interface BigTrade {
  venue: string
  question: string
  side: string
  price: number
  size: number
  notional: number
  isWinner: number
  tradedAt: string
  alias: string
}

export interface GraphPayload {
  nodes: Array<{
    id: string
    kind: 'trader' | 'market'
    group: string
    value: number
    label: string
    winRate?: number
    smartScore?: number
    isWhale?: boolean
    venue?: string
    status?: string
  }>
  links: Array<{
    source: string
    target: string
    value: number
    trades: number
    wins: number
    losses: number
  }>
}

function openDb(): Database {
  return new Database(dbPath(), { readonly: true })
}

/**
 * Leaderboard of attributable traders ranked by smart-money score —
 * accounts that keep buying the side that ends up winning, with their
 * sizing profile. Whales ride along even with a thin resolved history.
 */
export function loadSmartMoney(limit = 50): SmartTrader[] {
  const db = openDb()
  try {
    return (db.query(`
      SELECT id, venue, external_id, alias, trade_count, total_notional, avg_trade_size,
             max_trade_size, resolved_trade_count, winning_trade_count, win_rate, smart_score, is_whale
      FROM market_traders
      WHERE resolved_trade_count >= ? OR is_whale = 1
      ORDER BY smart_score DESC, total_notional DESC
      LIMIT ?
    `).all(MIN_RESOLVED, limit) as any[]).map(r => ({
      id: r.id,
      venue: r.venue,
      wallet: r.external_id,
      alias: r.alias || `${r.external_id.slice(0, 6)}…${r.external_id.slice(-4)}`,
      tradeCount: r.trade_count,
      totalNotional: r.total_notional,
      avgTradeSize: r.avg_trade_size,
      maxTradeSize: r.max_trade_size,
      resolvedTradeCount: r.resolved_trade_count,
      winningTradeCount: r.winning_trade_count,
      winRate: r.win_rate,
      smartScore: r.smart_score,
      isWhale: r.is_whale === 1,
    }))
  }
  finally {
    db.close()
  }
}

/** Largest recent fills across both venues (Kalshi fills are anonymous). */
export function loadBigTrades(limit = 30): BigTrade[] {
  const db = openDb()
  try {
    return db.query(`
      SELECT t.venue, pm.question, t.side, t.price, t.size, t.notional, t.is_winner AS isWinner,
             t.traded_at AS tradedAt, COALESCE(NULLIF(tr.alias, ''), tr.external_id, '') AS alias
      FROM market_trades t
      JOIN prediction_markets pm ON pm.id = t.prediction_market_id
      LEFT JOIN market_traders tr ON tr.id = t.market_trader_id
      ORDER BY t.notional DESC
      LIMIT ?
    `).all(limit) as BigTrade[]
  }
  finally {
    db.close()
  }
}

/**
 * The money-flow network: top traders and the markets they bought,
 * shaped for a force-directed graph. Trader node size tracks notional,
 * market node size tracks volume through those traders, edge width
 * tracks the flow between them; wins/losses ride on each edge so the
 * UI can color winning flow.
 */
export function loadGraph(traderLimit = 40): GraphPayload {
  const db = openDb()
  try {
    const traders = db.query(`
      SELECT id, alias, external_id, total_notional, win_rate, smart_score, is_whale, resolved_trade_count
      FROM market_traders
      WHERE trade_count > 0 AND (resolved_trade_count >= ${MIN_RESOLVED} OR is_whale = 1 OR total_notional > 0)
      ORDER BY smart_score DESC, total_notional DESC
      LIMIT ?
    `).all(traderLimit) as any[]

    if (!traders.length)
      return { nodes: [], links: [] }

    const ids = traders.map(t => t.id)
    const placeholders = ids.map(() => '?').join(',')

    const flows = db.query(`
      SELECT t.market_trader_id AS tid, t.prediction_market_id AS mid,
             SUM(t.notional) AS notional, COUNT(*) AS trades,
             SUM(t.is_winner = 1) AS wins, SUM(t.is_winner = 0) AS losses
      FROM market_trades t
      WHERE t.market_trader_id IN (${placeholders})
      GROUP BY t.market_trader_id, t.prediction_market_id
    `).all(...ids) as any[]

    const marketIds = [...new Set(flows.map(f => f.mid))]
    const markets = marketIds.length
      ? db.query(`
          SELECT id, venue, question, status, volume
          FROM prediction_markets WHERE id IN (${marketIds.map(() => '?').join(',')})
        `).all(...marketIds) as any[]
      : []

    const nodes: GraphPayload['nodes'] = [
      ...traders.map(t => ({
        id: `t:${t.id}`,
        kind: 'trader' as const,
        group: t.is_whale === 1 ? 'whale' : (t.smart_score >= 25 && t.resolved_trade_count >= MIN_RESOLVED ? 'smart' : 'trader'),
        value: t.total_notional,
        label: t.alias || `${t.external_id.slice(0, 6)}…`,
        winRate: t.win_rate,
        smartScore: t.smart_score,
        isWhale: t.is_whale === 1,
      })),
      ...markets.map(m => ({
        id: `m:${m.id}`,
        kind: 'market' as const,
        group: `market-${m.venue}`,
        value: m.volume,
        label: m.question,
        venue: m.venue,
        status: m.status,
      })),
    ]

    const links: GraphPayload['links'] = flows.map(f => ({
      source: `t:${f.tid}`,
      target: `m:${f.mid}`,
      value: f.notional,
      trades: f.trades,
      wins: f.wins,
      losses: f.losses,
    }))

    return { nodes, links }
  }
  finally {
    db.close()
  }
}
