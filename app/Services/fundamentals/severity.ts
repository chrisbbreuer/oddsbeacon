/**
 * Turning a league's injury wording into a number a signal can use.
 *
 * Every league words availability differently, and the same word does not
 * mean the same thing twice: baseball's "60-Day-IL" is a certainty,
 * football's "Questionable" is roughly a coin flip, and basketball's
 * "Day-To-Day" usually means they play. A signal cannot branch on prose,
 * so this maps to 0..1 where 1 is certainly unavailable.
 *
 * Deliberately coarse. These are not calibrated probabilities and should
 * not be presented as such: they are an ordering with sane gaps, good
 * enough to say "this team is missing more than that team" and no more.
 * Once `calibration_buckets` has real settled history the mapping can be
 * fitted rather than asserted, and the raw `status` is kept on every row
 * so that refit is possible without re-ingesting.
 */

/** Longest match wins, so 'day-to-day' is not shadowed by 'day'. */
const SEVERITY: Array<[string, number]> = [
  ['season-ending', 1],
  ['60-day-il', 1],
  ['15-day-il', 0.9],
  ['10-day-il', 0.85],
  ['7-day-il', 0.8],
  ['injured-reserve', 1],
  ['suspension', 1],
  ['suspended', 1],
  ['out for season', 1],
  ['paternity', 1],
  ['bereavement', 1],
  ['personal', 0.8],
  ['day-to-day', 0.3],
  ['day to day', 0.3],
  ['questionable', 0.5],
  ['doubtful', 0.75],
  ['probable', 0.25],
  ['available', 0],
  ['active', 0],
  ['out', 1],
]

export function injurySeverity(status: unknown): number {
  const text = String(status ?? '').trim().toLowerCase()
  if (!text)
    return 0

  let best = 0
  let bestLength = 0

  for (const [token, value] of SEVERITY) {
    if (text.includes(token) && token.length > bestLength) {
      best = value
      bestLength = token.length
    }
  }

  // An unrecognised status is treated as a real absence rather than as
  // availability: a feed only lists a player when something is wrong, so
  // the safer default when we cannot read the wording is that they are
  // affected.
  return bestLength > 0 ? best : 0.5
}
