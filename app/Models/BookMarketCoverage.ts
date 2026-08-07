import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * BookMarketCoverage — which bet types each book is actually quoting on an
 * event, and when we last saw them do it.
 *
 * ### Why this cannot be derived from `odds`
 *
 * It nearly can, and the near-miss is the point. Joining `odds` through
 * `selections` and `markets` tells you which markets a book has a *price*
 * on right now, which is a different question from which markets it
 * *offers*. A book that pulled its player props ten minutes before kickoff
 * looks, through that join, exactly like a book that never offered them —
 * and those two facts lead somewhere different. The first is a market
 * closing, which is information; the second is a gap in our coverage,
 * which is a bug.
 *
 * Recording the offer separately from the price is what keeps them apart,
 * and it is what lets us answer "what can this book be asked about"
 * without fetching the book.
 *
 * ### What it costs
 *
 * One row per (book, event, market type), touched rather than rewritten.
 * `lastSeenAt` is the whole payload: it turns the table into a decay
 * signal, so a market that stops appearing ages out visibly instead of
 * lingering as a claim we can no longer support.
 */
export default defineModel({
  name: 'BookMarketCoverage',
  table: 'book_market_coverage',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSeeder: { count: 0 },
  },

  indexes: [
    // The natural key, and the upsert target for every ingestion pass.
    {
      name: 'book_market_coverage_book_event_type',
      columns: ['bookmaker_id', 'market_event_id', 'market_type'],
      unique: true,
    },
    // "What does this event have on offer, across every book" — the read
    // behind the per-event markets endpoint.
    { name: 'book_market_coverage_event', columns: ['market_event_id'] },
  ],

  attributes: {
    /**
     * The bet type, in our vocabulary rather than the book's.
     *
     * 'h2h' | 'spreads' | 'totals' | 'h2h_lay' | 'player_points' | …
     * Not an enum: the set grows every time a book invents a prop, and a
     * validation rule that has to be edited before a new market can be
     * recorded would make the schema the thing blocking coverage.
     */
    marketType: {
      type: 'string',
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(1).max(40) },
      factory: faker => faker.helpers.arrayElement(['h2h', 'spreads', 'totals']),
    },
    /**
     * How many distinct lines the book is quoting on this market type.
     *
     * Books disagree about the line, and that disagreement is information.
     * A single number here separates a book offering one main total from
     * one offering an alternate ladder, which is the difference between
     * having a price and having a market.
     */
    lineCount: {
      type: 'number',
      fillable: true,
      default: 0,
      validation: { rule: schema.number().min(0) },
      factory: () => 1,
    },
    /** When this book was last observed offering this market. */
    lastSeenAt: {
      type: 'string',
      fillable: true,
      default: '',
      validation: { rule: schema.string().max(40) },
      factory: () => new Date().toISOString(),
    },
  },

  belongsTo: ['Bookmaker', 'MarketEvent'],
} as const)
