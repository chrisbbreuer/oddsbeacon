import { Database } from 'bun:sqlite'

/**
 * Evidence — the measurable case for or against a side, computed from
 * our own ingested tape and nothing else.
 *
 * This is deliberately the whole quantitative model. The AI layer that
 * sits above it can only argue about candidates produced here; it cannot
 * introduce a market, a side, or a fair value of its own. That ordering
 * is what makes "AI-driven" checkable: every automated position traces
 * back to rows in market_trades and prediction_markets, and each signal
 * records the sample it stood on.
 *
 * Fair value starts at the venue's own price — the market is the best
 * single estimate available — and each signal nudges it. Nudges are
 * additive in probability points and individually clamped, so no single
 * signal can run away with the estimate, and the total is clamped again.
 */

/** Lookback for the flow and smart-money queries. */
const WINDOW_HOURS = 24
/** Bayesian prior weight, mirroring the analytics pass's shrinkage. */
const PRIOR_WEIGHT = 6
/** No single signal may move fair value more than this. */
const MAX_SIGNAL_CONTRIBUTION = 0.08
/** Nor may all of them together. */
const MAX_TOTAL_CONTRIBUTION = 0.15
/** Below this many fills a market is too thin to model at all. */
const MIN_FILLS = 8

export interface EvidenceItem {
  kind: string
  summary: string
  value: number
  contribution: number
  sampleSize: number
  windowHours: number
}

export interface Candidate {
  predictionMarketId: number
  venue: string
  externalId: string
  question: string
  category: string
  /** Side the evidence favours. */
  side: string
  /** The venue's price for that side, 0..1. */
  marketPrice: number
  /** Our estimate for that side, 0..1. */
  fairValue: number
  /** fairValue − marketPrice. */
  edge: number
  /** 0..1, from how much agreeing evidence there is. */
  confidence: number
  liquidity: number
  evidence: EvidenceItem[]
}

interface MarketRow {
  id: number
  venue: string
  external_id: string
  question: string
  category: string
  last_price: number
  liquidity: number
}

interface FlowRow {
  side: string
  fills: number
  notional: number
  /** Notional weighted by the buyer's smart score, 0..100. */
  smart_notional: number
  /** Resolved wins over resolved trades, for the accounts in this flow. */
  resolved: number
  wins: number
}

export interface EvidenceOptions {
  /** Restrict to these venues. Empty means both. */
  venues?: string[]
  /** Restrict to these categories. Empty means all. */
  categories?: string[]
  /** Minimum absolute edge to report a candidate at all. */
  minEdge?: number
  limit?: number
}

/**
 * Build the candidate set.
 *
 * Only open markets with a real price and enough recent flow qualify —
 * an untraded market has no evidence, and a fair value derived from
 * nothing is worse than no opinion.
 */
export function buildCandidates(db: Database, options: EvidenceOptions = {}): Candidate[] {
  const venues = options.venues?.filter(Boolean) ?? []
  const categories = options.categories?.filter(Boolean) ?? []
  const minEdge = options.minEdge ?? 0.03
  const limit = options.limit ?? 40

  const where: string[] = [
    `status = 'open'`,
    `last_price > 0.02`,
    `last_price < 0.98`,
  ]
  const params: string[] = []

  if (venues.length > 0) {
    where.push(`venue IN (${venues.map(() => '?').join(', ')})`)
    params.push(...venues)
  }

  if (categories.length > 0) {
    where.push(`LOWER(category) IN (${categories.map(() => '?').join(', ')})`)
    params.push(...categories.map(c => c.toLowerCase()))
  }

  const markets = db.prepare(`
    SELECT id, venue, external_id, question, category, last_price, liquidity
    FROM prediction_markets
    WHERE ${where.join(' AND ')}
    ORDER BY volume DESC
    LIMIT 400
  `).all(...params) as MarketRow[]

  const candidates: Candidate[] = []

  for (const market of markets) {
    const candidate = evaluateMarket(db, market)
    if (candidate && Math.abs(candidate.edge) >= minEdge)
      candidates.push(candidate)
  }

  // Strongest conviction first: edge alone rewards thin markets where
  // the estimate is least trustworthy, so rank on edge × confidence.
  candidates.sort((a, b) => (b.edge * b.confidence) - (a.edge * a.confidence))

  return candidates.slice(0, limit)
}

/**
 * Evaluate one market: gather the per-side flow, pick the side the
 * evidence favours, and record what moved the estimate.
 */
function evaluateMarket(db: Database, market: MarketRow): Candidate | null {
  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString()

  const flows = db.prepare(`
    SELECT
      t.side AS side,
      COUNT(*) AS fills,
      COALESCE(SUM(t.notional), 0) AS notional,
      COALESCE(SUM(t.notional * COALESCE(tr.smart_score, 0) / 100.0), 0) AS smart_notional,
      COALESCE(SUM(CASE WHEN t.is_winner != -1 THEN 1 ELSE 0 END), 0) AS resolved,
      COALESCE(SUM(CASE WHEN t.is_winner = 1 THEN 1 ELSE 0 END), 0) AS wins
    FROM market_trades t
    LEFT JOIN market_traders tr ON tr.id = t.market_trader_id
    WHERE t.prediction_market_id = ? AND t.traded_at >= ?
    GROUP BY t.side
  `).all(market.id, since) as FlowRow[]

  const totalFills = flows.reduce((sum, f) => sum + f.fills, 0)
  if (totalFills < MIN_FILLS)
    return null

  // The side with the most notional behind it is the one being argued
  // for; everything else is the other side of the same claim.
  const leader = flows.reduce<FlowRow | null>((best, f) => (!best || f.notional > best.notional ? f : best), null)
  if (!leader)
    return null

  const totalNotional = flows.reduce((sum, f) => sum + f.notional, 0)
  if (totalNotional <= 0)
    return null

  // `last_price` is quoted for the yes side. A candidate on any other
  // side is worth the complement.
  const marketPrice = leader.side === 'yes' ? market.last_price : 1 - market.last_price

  const evidence: EvidenceItem[] = []

  // ---- Flow imbalance -------------------------------------------------
  // What share of the money over the window bought this side. Centered
  // on the price itself rather than 0.5: a side already quoted at 0.8
  // should attract ~80% of the flow, so only the excess is information.
  const flowShare = leader.notional / totalNotional
  evidence.push({
    kind: 'flow_imbalance',
    summary: `${pct(flowShare)} of $${round(totalNotional)} traded in ${WINDOW_HOURS}h bought ${leader.side}`,
    value: round(flowShare, 4),
    contribution: clampSignal((flowShare - marketPrice) * 0.10),
    sampleSize: totalFills,
    windowHours: WINDOW_HOURS,
  })

  // ---- Smart money ----------------------------------------------------
  // The same flow, weighted by each buyer's smart score. Only meaningful
  // where trades are attributable — Kalshi's tape is anonymous, so its
  // smart notional is structurally zero and the signal is skipped rather
  // than reported as a real zero.
  const smartShareTotal = flows.reduce((sum, f) => sum + f.smart_notional, 0)
  if (smartShareTotal > 0) {
    const smartShare = leader.smart_notional / smartShareTotal
    evidence.push({
      kind: 'smart_money',
      summary: `accuracy-weighted flow puts ${pct(smartShare)} behind ${leader.side}`,
      value: round(smartShare, 4),
      contribution: clampSignal((smartShare - marketPrice) * 0.18),
      sampleSize: totalFills,
      windowHours: WINDOW_HOURS,
    })
  }

  // ---- Trader accuracy ------------------------------------------------
  // How the accounts on this side have actually done on settled markets,
  // shrunk toward a coin flip so a 2-for-2 record does not outrank a
  // 40-for-50 one.
  if (leader.resolved > 0) {
    const shrunk = (leader.wins + PRIOR_WEIGHT * 0.5) / (leader.resolved + PRIOR_WEIGHT)
    evidence.push({
      kind: 'trader_accuracy',
      summary: `buyers of ${leader.side} are ${leader.wins}/${leader.resolved} on settled markets (${pct(shrunk)} shrunk)`,
      value: round(shrunk, 4),
      contribution: clampSignal((shrunk - 0.5) * 0.20),
      sampleSize: leader.resolved,
      windowHours: WINDOW_HOURS,
    })
  }

  // ---- Price trend ----------------------------------------------------
  // Where the side has traded recently versus the window as a whole.
  const trend = db.prepare(`
    SELECT
      COALESCE(AVG(CASE WHEN traded_at >= ? THEN price END), 0) AS recent,
      COALESCE(AVG(price), 0) AS baseline,
      COUNT(*) AS n
    FROM market_trades
    WHERE prediction_market_id = ? AND side = ? AND traded_at >= ?
  `).get(
    new Date(Date.now() - 3600_000 * 4).toISOString(),
    market.id,
    leader.side,
    since,
  ) as { recent: number, baseline: number, n: number }

  if (trend.recent > 0 && trend.baseline > 0) {
    const drift = trend.recent - trend.baseline
    evidence.push({
      kind: 'price_trend',
      summary: `${leader.side} traded at ${pct(trend.recent)} in the last 4h vs ${pct(trend.baseline)} over ${WINDOW_HOURS}h`,
      value: round(drift, 4),
      contribution: clampSignal(drift * 0.25),
      sampleSize: trend.n,
      windowHours: WINDOW_HOURS,
    })
  }

  // ---- Liquidity ------------------------------------------------------
  // Recorded because it caps size downstream, never as a directional
  // argument — hence a zero contribution.
  evidence.push({
    kind: 'liquidity',
    summary: `$${round(market.liquidity)} resting liquidity`,
    value: round(market.liquidity, 2),
    contribution: 0,
    sampleSize: 1,
    windowHours: WINDOW_HOURS,
  })

  // ---- Cross-venue ----------------------------------------------------
  // The same question priced on the other venue. Two venues that
  // disagree is the cleanest signal available, and the only one here
  // that does not depend on our own trader modelling.
  const other = db.prepare(`
    SELECT venue, last_price
    FROM prediction_markets
    WHERE venue != ? AND status = 'open' AND question = ? AND last_price > 0
    LIMIT 1
  `).get(market.venue, market.question) as { venue: string, last_price: number } | null

  if (other) {
    const otherPrice = leader.side === 'yes' ? other.last_price : 1 - other.last_price
    const gap = otherPrice - marketPrice
    evidence.push({
      kind: 'cross_venue',
      summary: `${other.venue} prices ${leader.side} at ${pct(otherPrice)} vs ${pct(marketPrice)} here`,
      value: round(gap, 4),
      contribution: clampSignal(gap * 0.35),
      sampleSize: 1,
      windowHours: WINDOW_HOURS,
    })
  }

  const totalContribution = clamp(
    evidence.reduce((sum, item) => sum + item.contribution, 0),
    -MAX_TOTAL_CONTRIBUTION,
    MAX_TOTAL_CONTRIBUTION,
  )

  const fairValue = clamp(marketPrice + totalContribution, 0.01, 0.99)

  return {
    predictionMarketId: market.id,
    venue: market.venue,
    externalId: market.external_id,
    question: market.question,
    category: market.category,
    side: leader.side,
    marketPrice: round(marketPrice, 4),
    fairValue: round(fairValue, 4),
    edge: round(fairValue - marketPrice, 4),
    confidence: confidenceFrom(evidence, totalFills),
    liquidity: market.liquidity,
    evidence,
  }
}

/**
 * Confidence from agreement and sample size, not from edge.
 *
 * Three signals pointing the same way on 300 fills is a different claim
 * from one signal on 9, even when both produce the same number. Agreement
 * is the share of directional signals that share the majority sign;
 * depth saturates so a very heavily traded market does not get arbitrarily
 * confident.
 */
function confidenceFrom(evidence: EvidenceItem[], fills: number): number {
  const directional = evidence.filter(item => item.contribution !== 0)
  if (directional.length === 0)
    return 0

  const positive = directional.filter(item => item.contribution > 0).length
  const agreement = Math.max(positive, directional.length - positive) / directional.length

  // Saturating depth: 8 fills ≈ 0.1, 100 ≈ 0.6, 500 ≈ 0.85.
  const depth = fills / (fills + 90)

  // Two signals is the floor for taking anything seriously.
  const breadth = Math.min(1, directional.length / 3)

  return round(clamp(agreement * 0.5 + depth * 0.3 + breadth * 0.2, 0, 1), 3)
}

function clampSignal(value: number): number {
  return round(clamp(value, -MAX_SIGNAL_CONTRIBUTION, MAX_SIGNAL_CONTRIBUTION), 4)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, places = 2): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
