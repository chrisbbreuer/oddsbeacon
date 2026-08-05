import { parseHTML } from 'ts-web-scraper'

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

/** The soccer competitions worth valuing, by our sport slug. */
export interface CompetitionTarget {
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
export const TRANSFERMARKT_COMPETITIONS: CompetitionTarget[] = [
  { sportSlug: 'epl', externalId: 'GB1', path: 'premier-league', tier: 1, label: 'Premier League' },
  { sportSlug: 'efl-championship', externalId: 'GB2', path: 'championship', tier: 2, label: 'EFL Championship' },
  { sportSlug: 'efl-league-one', externalId: 'GB3', path: 'league-one', tier: 3, label: 'EFL League One' },
  { sportSlug: 'efl-league-two', externalId: 'GB4', path: 'league-two', tier: 4, label: 'EFL League Two' },
  { sportSlug: 'laliga', externalId: 'ES1', path: 'laliga', tier: 1, label: 'LaLiga' },
  { sportSlug: 'laliga2', externalId: 'ES2', path: 'laliga2', tier: 2, label: 'LaLiga 2' },
  { sportSlug: 'seriea', externalId: 'IT1', path: 'serie-a', tier: 1, label: 'Serie A' },
  { sportSlug: 'serieb', externalId: 'IT2', path: 'serie-b', tier: 2, label: 'Serie B' },
  { sportSlug: 'bundesliga', externalId: 'L1', path: 'bundesliga', tier: 1, label: 'Bundesliga' },
  { sportSlug: 'bundesliga2', externalId: 'L2', path: '2-bundesliga', tier: 2, label: '2. Bundesliga' },
  { sportSlug: 'ligue1', externalId: 'FR1', path: 'ligue-1', tier: 1, label: 'Ligue 1' },
  { sportSlug: 'eredivisie', externalId: 'NL1', path: 'eredivisie', tier: 1, label: 'Eredivisie' },
  { sportSlug: 'ucl', externalId: 'CL', path: 'uefa-champions-league', tier: 1, label: 'Champions League' },
]

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
