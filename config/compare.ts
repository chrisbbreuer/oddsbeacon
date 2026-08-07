/**
 * **Comparison Configuration**
 *
 * One record per competitor, rendered by `resources/views/compare/[competitor].stx`.
 *
 * ### Why this is data rather than fourteen hand-written pages
 *
 * `resources/views/pricing.stx` makes the argument already, in its own
 * header: a page maintained separately from the thing it describes is a
 * page that eventually lies. A comparison page is worse than a pricing
 * page in that respect, because it makes claims about someone else's
 * product as well as our own, and the half that rots silently is ours.
 *
 * So each row here is a claim with a `verified` flag, and the template
 * renders an unverified claim differently rather than ticking it. The rule
 * for setting `verified: true` is narrow: something in our own repository
 * demonstrates it. Where that is a specific file, `evidence` names it, so
 * the next person to doubt a row can go and check rather than guess.
 *
 * ### Tone
 *
 * Every record carries a `betterWhen` — the case for choosing them over
 * us. It is not decoration. A comparison page with no honest concession
 * reads as marketing and gets discounted wholesale; the concession is what
 * buys the reader's attention for everything else. Where a competitor is
 * genuinely better at something, say so plainly.
 *
 * Named export, not default: a default import resolves to an empty module
 * in the stx server scope, which fails silently — the const is simply
 * `undefined` and every interpolation renders as literal `{{ }}`.
 */

/** One line of the feature matrix. */
export interface CompareRow {
  /** What is being compared, in the reader's words rather than ours. */
  feature: string
  /** Do we do this today? */
  us: boolean
  /** Do they? */
  them: boolean
  /**
   * True only when something in this repository demonstrates our side of
   * the row. False renders as "planned" rather than as a tick.
   */
  verified: boolean
  /** The file or subsystem that backs the claim, when there is one. */
  evidence?: string
  /** One sentence of why the row matters. */
  note?: string
}

export interface Comparison {
  /** URL segment: /compare/<slug>. */
  slug: string
  name: string
  /** The headline question, phrased the way someone would search it. */
  headline: string
  /** Two or three sentences positioning us against them. */
  positioning: string
  /** When they are the better choice. Required, deliberately. */
  betterWhen: string
  /** When we are. */
  betterForUs: string
  /** Their pricing, described rather than quoted to the cent. */
  pricing: string
  /** How our pricing compares, framed on what is included. */
  pricingOurs: string
  rows: CompareRow[]
  faq: Array<{ question: string, answer: string }>
}

/**
 * Rows that apply to every comparison.
 *
 * These are the things PredictHQ does that a pure odds feed does not do at
 * all, so they repeat across pages. Kept in one place so a claim cannot be
 * true on one page and false on another.
 */
const OURS_THROUGHOUT: CompareRow[] = [
  {
    feature: 'De-vigged fair value on every market',
    us: true,
    them: false,
    verified: true,
    evidence: 'app/Support/ — de-vig and fair price, with FairPrice recorded per selection',
    note: 'A raw price includes the book\'s margin. Every honest edge compares against the fair number, not the quoted one.',
  },
  {
    feature: 'Calibration: how well past probabilities held up',
    us: true,
    them: false,
    verified: true,
    evidence: 'CalibrationBucket model + /api/v1/calibration',
    note: 'A model that says 70% should be right about 70% of the time. Without this the number is an opinion.',
  },
  {
    feature: 'Automated positions with risk limits',
    us: true,
    them: false,
    verified: true,
    evidence: 'app/Services/trading/ — judgement, execution, reconciliation, positions',
    note: 'Bankroll cap, position cap, daily loss limit, and a global stop that outranks all of them.',
  },
  {
    feature: 'Paper trading before real money',
    us: true,
    them: false,
    verified: true,
    evidence: 'TradingStrategy paper mode — same decisions, same limits, simulated fills',
    note: 'A strategy has a track record before it has money behind it.',
  },
  {
    feature: 'Evidence recorded next to every decision',
    us: true,
    them: false,
    verified: true,
    evidence: 'DecisionEvidence + TradeDecision models',
    note: 'Why the engine did what it did, kept whether or not the trade worked.',
  },
  {
    feature: 'Prediction markets alongside sportsbooks',
    us: true,
    them: false,
    verified: true,
    evidence: 'app/Services/prediction-markets/ — Kalshi and Polymarket clients',
    note: 'Order-book probabilities next to bookmaker prices, in the same units.',
  },
]

const THE_ODDS_API: Comparison = {
  slug: 'the-odds-api',
  name: 'The Odds API',
  headline: 'How is PredictHQ different from The Odds API?',
  positioning:
    'The Odds API is a clean, well-documented odds feed that you pay for by the request. PredictHQ reads the '
    + 'bookmakers directly and then does something with the result — de-vigs it, scores it, and can act on it. '
    + 'If you want prices to build your own thing on, theirs is a good product. If you want the analysis and the '
    + 'positions, that is the part they do not sell.',
  betterWhen:
    'You want a documented feed with a support contract and a stable schema, and you are building your own '
    + 'analysis on top. They have been doing exactly that for years, their docs are genuinely good, and a paid '
    + 'contract is a real thing to have when a book changes its payload at 2am. We are newer at this than they are.',
  betterForUs:
    'You want the fair-value model, the calibration record, and the option to let it trade — not just the prices.',
  pricing: 'Per request, per market, per region. Historical snapshots cost 10× a live call.',
  pricingOurs:
    'Flat monthly by tier. Historical price history is included, because we already record every move to run '
    + 'our own model against it.',
  rows: [
    {
      feature: 'Odds from major sportsbooks',
      us: true,
      them: true,
      verified: true,
      evidence: 'Bookmaker seeder fixtures + app/Services/odds/',
      note: 'Both cover the books that matter. They have more of them today.',
    },
    {
      feature: 'Historical odds snapshots',
      us: true,
      them: true,
      verified: true,
      evidence: 'OddsSnapshot + /api/v1/historical/odds',
      note: 'Theirs costs 10× a live request, which is fair — storing it is a real cost for them. It is close to free for us only because the fair-value model needs the history anyway.',
    },
    {
      feature: 'Scores and results',
      us: true,
      them: true,
      verified: true,
      evidence: 'app/Services/scores/espn.ts',
    },
    {
      feature: 'Player props and alternate lines',
      us: false,
      them: true,
      verified: false,
      note: 'They have this today and we do not. The schema carries it (Market.playerName) and the adapters are the missing half.',
    },
    {
      feature: 'Exchange lay prices and traded volume',
      us: false,
      them: true,
      verified: false,
      note: 'Planned via the exchange adapters. Their h2h_lay is live now.',
    },
    {
      feature: 'Sub-minute price updates',
      us: false,
      them: false,
      verified: false,
      note: 'Their historical snapshots are 5-minute. Our loop polls per league at second-level cadence and is shipped — but a loop with no book adapters behind it polls nothing, so this stays a dash until the first adapter lands.',
    },
    {
      feature: 'Arbitrage across books, computed for you',
      us: true,
      them: false,
      verified: true,
      evidence: '/api/v1/arbitrage — computed per request, uncached',
    },
    ...OURS_THROUGHOUT,
  ],
  faq: [
    {
      question: 'Do you resell The Odds API?',
      answer:
        'No. PredictHQ reads the bookmakers directly. The Odds API remains configured as a fallback for leagues '
        + 'our own adapters do not cover yet, so coverage never depends on a gap in our work.',
    },
    {
      question: 'Can I just get the raw prices?',
      answer:
        'Yes. /api/v1/odds returns the board, and /api/v1/training returns bulk rows for model building. An API '
        + 'key meters both against your plan.',
    },
    {
      question: 'Is your data as complete as theirs?',
      answer:
        'Not yet, in book count and in player props. It is more complete on the things built on top of the '
        + 'prices — fair value, calibration, and the decision record.',
    },
  ],
}

const ODDSJAM: Comparison = {
  slug: 'oddsjam',
  name: 'OddsJam',
  headline: 'How is PredictHQ different from OddsJam?',
  positioning:
    'OddsJam is built for the bettor at the screen: find the positive-EV bet, find the arbitrage, place it '
    + 'yourself. PredictHQ is built for the strategy that runs whether or not you are watching, with the '
    + 'decision and its evidence recorded either way.',
  betterWhen:
    'You want a polished consumer tool with very broad book coverage and a large odds screen you drive by hand. '
    + 'OddsJam covers more sportsbooks than we do and their screen is genuinely excellent for manual work.',
  betterForUs:
    'You want the decisions automated, limited, and auditable rather than surfaced for you to act on.',
  pricing: 'Consumer subscription tiers, priced per seat.',
  pricingOurs: 'Flat monthly by tier, with the API included rather than sold separately.',
  rows: [
    { feature: 'Positive-EV screen', us: true, them: true, verified: true, evidence: '/api/v1/edges — best price against de-vigged fair value' },
    { feature: 'Arbitrage finder', us: true, them: true, verified: true, evidence: '/api/v1/arbitrage' },
    { feature: 'Line movement history', us: true, them: true, verified: true, evidence: 'OddsSnapshot + /api/v1/movements' },
    { feature: 'Very broad book coverage', us: false, them: true, verified: false, note: 'They cover more books than we do today.' },
    { feature: 'Public API with metered keys', us: true, them: true, verified: true, evidence: 'routes/v1.ts + ApiKey/ApiUsage models' },
    ...OURS_THROUGHOUT,
  ],
  faq: [
    {
      question: 'Is this a betting tool or a trading system?',
      answer:
        'A trading system. The board and the edge screen exist, but the product is the strategy that acts on '
        + 'them inside limits you set, with a global stop that outranks every strategy.',
    },
  ],
}

const OPTICODDS: Comparison = {
  slug: 'opticodds',
  name: 'OpticOdds',
  headline: 'How is PredictHQ different from OpticOdds?',
  positioning:
    'OpticOdds sells low-latency odds infrastructure, largely to businesses. That is the closest thing to what '
    + 'our ingestion layer does. The difference is what sits above it: we are not only moving prices around, we '
    + 'are pricing them and taking positions on them.',
  betterWhen:
    'You need the fastest, broadest raw feed you can buy and you have your own modelling team. That is what '
    + 'they are for, and they are good at it.',
  betterForUs: 'You want the model and the execution as well as the feed.',
  pricing: 'Enterprise feed pricing, negotiated.',
  pricingOurs: 'Flat monthly by tier, self-serve.',
  rows: [
    { feature: 'Low-latency odds feed', us: false, them: true, verified: false, note: 'Their latency is a product guarantee. Ours is an engine still being built.' },
    { feature: 'WebSocket push', us: false, them: true, verified: false, note: 'Planned per book where the book offers one.' },
    { feature: 'Historical archive', us: true, them: true, verified: true, evidence: 'OddsSnapshot' },
    ...OURS_THROUGHOUT,
  ],
  faq: [
    {
      question: 'Can PredictHQ be used purely as a feed?',
      answer:
        'Yes, through /api/v1 with an API key. But if all you need is a feed, a dedicated feed vendor will '
        + 'likely serve you better than we will.',
    },
  ],
}

const BUILD_IT_YOURSELF: Comparison = {
  slug: 'building-it-yourself',
  name: 'building it yourself',
  headline: 'Should you just build this yourself?',
  positioning:
    'Often, yes — and we would rather say so than pretend otherwise. Reading a bookmaker\'s public endpoint is '
    + 'not hard. What takes the time is everything after: deciding that two feeds describe the same game, '
    + 'removing the margin correctly, keeping a change log rather than a poll log, and noticing when a book '
    + 'quietly stops returning anything.',
  betterWhen:
    'You need one or two books for one league, or the data is a means to something you care about more. A '
    + 'weekend gets you a working scraper, and you will own it completely.',
  betterForUs:
    'You want the second year of it — the identity resolution, the calibration record, and the part that '
    + 'notices a silently broken feed before it costs you.',
  pricing: 'Free, plus your time, plus whatever a wrong number costs you.',
  pricingOurs: 'Flat monthly.',
  rows: [
    {
      feature: 'Reading one book\'s prices',
      us: true,
      them: true,
      verified: true,
      note: 'Genuinely a weekend. This is not the hard part and we would not claim it is.',
    },
    {
      feature: 'Deciding two feeds mean the same game',
      us: true,
      them: false,
      verified: true,
      evidence: 'app/Services/ingest/resolve.ts',
      note: 'Matching on names attaches prices to the wrong game, silently. That module exists because it happened.',
    },
    {
      feature: 'History as a change log, not a poll log',
      us: true,
      them: false,
      verified: true,
      evidence: 'app/Services/ingest/prices.ts — snapshots appended only on change',
      note: 'Snapshot every poll and you have billions of rows a season saying nothing.',
    },
    {
      feature: 'Noticing a feed that has silently stopped',
      us: true,
      them: false,
      verified: true,
      evidence: 'app/Services/watchdog.ts + IngestRun provenance',
      note: 'A feed matching nothing looks exactly like a quiet market until you check.',
    },
    ...OURS_THROUGHOUT,
  ],
  faq: [
    {
      question: 'What is the part people underestimate?',
      answer:
        'Identity. Every provider names the same league, club, and market differently, and matching them by name '
        + 'fails quietly rather than loudly — prices land on the wrong game and nothing errors.',
    },
  ],
}

export const comparisons: Comparison[] = [
  THE_ODDS_API,
  ODDSJAM,
  OPTICODDS,
  BUILD_IT_YOURSELF,
]

export function comparisonFor(slug: string): Comparison | null {
  return comparisons.find(entry => entry.slug === slug) ?? null
}

/** Rows we claim but have not yet shipped, across every page. */
export function unverifiedClaims(): Array<{ slug: string, feature: string }> {
  return comparisons.flatMap(entry =>
    entry.rows
      .filter(row => row.us && !row.verified)
      .map(row => ({ slug: entry.slug, feature: row.feature })),
  )
}
