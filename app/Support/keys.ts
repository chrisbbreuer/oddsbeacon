/**
 * Normalization and key derivation shared by every ingestion path.
 *
 * Feeds disagree about spelling, punctuation, casing, and how to say "no
 * line". Every one of those disagreements has to be resolved the same way
 * in every provider or rows silently fail to match — which is exactly the
 * failure the old ingestion had, where a feed's "Los Angeles Lakers" never
 * matched a stored "Lakers" and the mismatch surfaced as an empty board
 * rather than an error.
 */

/**
 * Lowercase, strip everything that is not a letter or digit.
 *
 * "Los Angeles Lakers" → "losangeleslakers"; "St. Louis" → "stlouis". Used
 * as the join key for teams and books, so it must stay stable — changing
 * it invalidates every stored `searchKey`.
 */
export function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Tokens of a name, lowercased, punctuation removed, short words dropped.
 *
 * Feeds the fuzzy matcher: "Los Angeles Lakers" → ['los','angeles','lakers'].
 */
export function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1)
}

/**
 * NULL-safe string form of a line or handicap, for the unique indexes on
 * `markets` and `selections`.
 *
 * Returns '' for null/undefined/NaN so "no line" is a real value the
 * database can compare. A nullable column in a unique index constrains
 * nothing — SQL treats each NULL as distinct — so without this every
 * moneyline upsert would insert a fresh duplicate row on every pass.
 *
 * The number is normalized through `Number()` first so 4.50, 4.5, and
 * "4.5" all produce the same key.
 */
export function lineKey(value: number | null | undefined): string {
  if (value === null || value === undefined)
    return ''
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : ''
}

/** Probability implied by decimal odds. Still contains the book's margin. */
export function impliedProbability(decimal: number): number {
  return decimal > 0 ? 1 / decimal : 0
}

/** Decimal odds from a probability. */
export function decimalFromProbability(prob: number): number {
  return prob > 0 ? 1 / prob : 0
}

/** Convert decimal odds to an American/moneyline number, e.g. +138 / −145. */
export function toAmericanNumber(decimal: number): number {
  if (!Number.isFinite(decimal) || decimal <= 1)
    return 0
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1))
}

/** Convert an American/moneyline number to decimal odds. */
export function decimalFromAmerican(american: number): number {
  if (!Number.isFinite(american) || american === 0)
    return 0
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american)
}

/**
 * Coerce a provider timestamp to a UTC ISO-8601 string, or '' if it cannot
 * be parsed.
 *
 * Providers send ISO with and without a zone, epoch seconds, and epoch
 * milliseconds. A value that parses to nonsense is worse than an empty one
 * here: `commenceAt` drives closing-line capture, so a date misread as
 * 1970 would freeze a "closing" line for a game that has not been played.
 */
export function toIso(value: unknown): string {
  if (value === null || value === undefined || value === '')
    return ''

  if (typeof value === 'number') {
    // Heuristic: anything below ~1e11 is seconds, above is milliseconds.
    const ms = value < 1e11 ? value * 1000 : value
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString()
  }

  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

/** Now, as the UTC ISO string every timestamp column in this app stores. */
export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Similarity between two names, 0..1, from token overlap (Jaccard) with a
 * bonus for a shared final token.
 *
 * The last token carries most of the identifying weight in team names —
 * "Los Angeles Lakers" and "LA Lakers" share only "lakers", while "Los
 * Angeles Lakers" and "Los Angeles Clippers" share two tokens but are
 * different clubs. Weighting the nickname is what keeps the second pair
 * from scoring higher than the first.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.length === 0 || tb.length === 0)
    return 0

  const setA = new Set(ta)
  const setB = new Set(tb)
  let shared = 0
  for (const t of setA) {
    if (setB.has(t))
      shared++
  }
  const union = new Set([...setA, ...setB]).size
  const jaccard = union > 0 ? shared / union : 0

  const lastMatch = ta[ta.length - 1] === tb[tb.length - 1] ? 1 : 0
  return Math.min(1, jaccard * 0.6 + lastMatch * 0.4)
}
