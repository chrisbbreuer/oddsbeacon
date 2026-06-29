import process from 'node:process'
import { SyntheticProvider } from './synthetic'
import { TheOddsApiProvider } from './the-odds-api'

/** A single price refresh for one bookmaker on one selection. */
export interface OddsUpdate {
  selectionId: number
  bookmakerId: number
  price: number
}

/**
 * A source of live odds. Implementations either pull from an external
 * feed (TheOddsAPI) or synthesize movement from the current board so the
 * realtime pipeline works end-to-end without an API key.
 */
export interface OddsProvider {
  readonly name: string
  fetchUpdates: () => Promise<OddsUpdate[]>
}

/**
 * Pick the active provider: the real feed when `ODDS_API_KEY` is set,
 * otherwise the synthetic mover so `./buddy dev` shows live updates out
 * of the box.
 */
export function resolveProvider(): OddsProvider {
  const key = process.env.ODDS_API_KEY
  return key ? new TheOddsApiProvider(key) : new SyntheticProvider()
}
