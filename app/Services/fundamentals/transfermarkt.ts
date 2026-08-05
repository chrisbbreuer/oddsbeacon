import type { Database } from 'bun:sqlite'
import process from 'node:process'
import { fetchHTML, parseHTML } from 'ts-web-scraper'
import { loadSports, resolveTeam } from '../ingest/resolve'
import { IngestRunTracker } from '../ingest/run'

/**
 * Squad valuations from Transfermarkt's public competition pages.
 *
 * What this buys is the one input that can disagree with a bookmaker
 * rather than average it. Every other number this system prices with is
 * derived from book quotes, so a mispriced fixture stays mispriced no
 * matter how carefully it is de-vigged. Kalshi lists cup ties and
 * friendlies pairing a first-division side against a fourth-division one
 * (`KXEFLCUPGAME` alone is full of them), and squad value plus league
 * tier is what tells those apart.
 *
 * The DOM is the contract here. Transfermarkt exposes the club name/id,
 * squad size, average age, and total market value together in each row;
 * keeping those fields tied to a single row prevents cross-club values
 * when the table is re-sorted.
 */

const BASE = process.env.TRANSFERMARKT_BASE_URL || 'https://www.transfermarkt.com'
const USER_AGENT = process.env.TRANSFERMARKT_USER_AGENT
  || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

export interface ValuationResult {
  provider: string
  status: string
  clubsWritten: number
  competitions: number
  unmatched: number
  errors: string[]
}

/** The soccer competitions worth valuing, by our sport slug. */
interface CompetitionTarget {
  sportSlug: string
  /** Transfermarkt's competition id and canonical path slug. */
  externalId: string
  path: string
  /** 1 = top flight of its country. */
  tier: number
  label: string
}

/**
 * Deliberately explicit rather than discovered. Tier is the field doing
 * most of the work in a mismatch, and inferring it from a name is exactly
 * the kind of guess that quietly mislabels a second division as a first.
 */
const COMPETITIONS: CompetitionTarget[] = [
  { sportSlug: 'epl', externalId: 'GB1', path: 'premier-league', tier: 1, label: 'Premier League' },
  { sportSlug: 'laliga', externalId: 'ES1', path: 'laliga', tier: 1, label: 'LaLiga' },
  { sportSlug: 'seriea', externalId: 'IT1', path: 'serie-a', tier: 1, label: 'Serie A' },
  { sportSlug: 'bundesliga', externalId: 'L1', path: 'bundesliga', tier: 1, label: 'Bundesliga' },
  { sportSlug: 'ucl', externalId: 'CL', path: 'uefa-champions-league', tier: 1, label: 'Champions League' },
]

export function transfermarktConfigured(): boolean {
  return true
}

export interface TransfermarktClub {
  externalId: string
  name: string
  squadSize: number
  averageAgeYears: number
  marketValueEur: number
}

/** Parse '€1.20bn' / '450.00m' / '900k' into whole euros. */
export function parseMarketValue(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw))
    return Math.max(0, Math.round(raw))

  const text = String(raw ?? '').trim().toLowerCase().replace(/[€,\s]/g, '')
  if (!text)
    return 0

  const match = text.match(/^([\d.]+)(bn|m|k)?$/)
  if (!match)
    return 0

  const amount = Number(match[1])
  if (!Number.isFinite(amount))
    return 0

  const scale = match[2] === 'bn' ? 1e9 : match[2] === 'm' ? 1e6 : match[2] === 'k' ? 1e3 : 1
  return Math.round(amount * scale)
}

/** Read club facts from Transfermarkt's `table.items` competition DOM. */
export function parseTransfermarktClubs(html: string): TransfermarktClub[] {
  const document = parseHTML(html)
  const clubs = new Map<string, TransfermarktClub>()

  for (const row of document.querySelectorAll('table.items > tbody > tr')) {
    const nameLink = row.querySelector('td.hauptlink a[href*="/verein/"]')
    const href = nameLink?.getAttribute('href') || ''
    const externalId = href.match(/\/verein\/(\d+)/)?.[1]
    if (!nameLink || !externalId)
      continue

    const cells = row.children.filter(child => child.tagName.toLowerCase() === 'td')
    const nameCellIndex = cells.findIndex(cell => cell.querySelector('a[href*="/verein/"]') === nameLink)
    if (nameCellIndex < 0)
      continue

    const valueCell = row.querySelector('td.rechts.hauptlink') || cells.at(-1)
    const marketValueEur = parseMarketValue(valueCell?.textContent)
    const name = (nameLink.getAttribute('title') || nameLink.textContent).replace(/\s+/g, ' ').trim()
    if (!name || marketValueEur <= 0)
      continue

    clubs.set(externalId, {
      externalId,
      name,
      squadSize: Number.parseInt(cells[nameCellIndex + 1]?.textContent || '0', 10) || 0,
      averageAgeYears: Number.parseFloat(cells[nameCellIndex + 2]?.textContent || '0') || 0,
      marketValueEur,
    })
  }

  return [...clubs.values()]
}

export async function ingestClubValuations(db: Database): Promise<ValuationResult> {
  const tracker = new IngestRunTracker(db, 'transfermarkt', 'valuations')
  tracker.start()

  const sportIds = new Map(loadSports(db).map(s => [s.slug, s.id]))
  const capturedAt = new Date().toISOString()

  const insert = db.prepare(`
    INSERT INTO club_valuations
      (sports_team_id, squad_value_eur, squad_size, average_age_years, league_tier,
       competition, source, external_id, captured_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'transfermarkt', ?, ?, ?, ?)
  `)

  let clubsWritten = 0
  let competitions = 0

  for (const target of COMPETITIONS) {
    const sportId = sportIds.get(target.sportSlug)
    if (!sportId)
      continue

    const url = `${BASE}/${target.path}/startseite/wettbewerb/${target.externalId}`
    tracker.requestCount++

    try {
      const document = await fetchHTML(url, {
        timeout: 15_000,
        userAgent: USER_AGENT,
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
      })
      const clubs = parseTransfermarktClubs(document.innerHTML)
      if (clubs.length === 0)
        throw new Error('club table was missing or empty')

      db.run('BEGIN')
      try {
        for (const club of clubs) {
          tracker.rowsRead++
          const teamId = resolveTeam(db, sportId, club.name)

          if (!teamId) {
            tracker.unmatchedCount++
            continue
          }

          insert.run(
            teamId,
            club.marketValueEur,
            club.squadSize,
            club.averageAgeYears,
            target.tier,
            target.label,
            club.externalId,
            capturedAt,
            capturedAt,
            capturedAt,
          )
          clubsWritten++
          tracker.rowsWritten++
        }
        db.run('COMMIT')
      }
      catch (err) {
        try {
          db.run('ROLLBACK')
        }
        catch { /* the original error is the useful one */ }
        throw err
      }

      competitions++
    }
    catch (err) {
      tracker.fail(`${target.label}: ${(err as Error).message}`)
    }
  }

  const { status, errors } = tracker.finish(`${competitions} competitions · ${clubsWritten} clubs`)

  return {
    provider: 'transfermarkt',
    status,
    clubsWritten,
    competitions,
    unmatched: tracker.unmatchedCount,
    errors,
  }
}
