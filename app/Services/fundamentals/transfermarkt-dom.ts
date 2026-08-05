import { createHash } from 'node:crypto'
import { parseHTML } from 'ts-web-scraper'
import { parseMarketValue } from './transfermarkt'

const clean = (value: unknown): string => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
const digits = (value: unknown): number => Number.parseInt(clean(value).replace(/[^\d-]/g, ''), 10) || 0

export function canonicalTransfermarktUrl(href: string, base = 'https://www.transfermarkt.com'): string {
  if (!href) return ''
  return new URL(href, base).toString().replace(/\?.*$/, '')
}

export interface TransfermarktSquadPlayer {
  externalId: string
  name: string
  profileUrl: string
  position: string
  dateOfBirth: string
  nationality: string
  marketValueEur: number
}

export function parseTransfermarktSquad(html: string, base?: string): TransfermarktSquadPlayer[] {
  const document = parseHTML(html)
  const players = new Map<string, TransfermarktSquadPlayer>()

  for (const row of document.querySelectorAll('table.items > tbody > tr')) {
    const link = row.querySelector('a[href*="/profil/spieler/"]')
    const href = link?.getAttribute('href') || ''
    const externalId = href.match(/\/spieler\/(\d+)/)?.[1]
    if (!link || !externalId) continue

    const cells = row.children.filter(child => child.tagName.toLowerCase() === 'td')
    const nationality = row.querySelector('img.flaggenrahmen')?.getAttribute('title') || ''
    const identityRows = row.querySelector('table.inline-table')?.querySelectorAll('tr') || []
    const position = clean(identityRows.at(-1)?.querySelector('td')?.textContent)
    const dateCell = cells.find(cell => /\d{1,2}\/\d{1,2}\/\d{4}|\w{3}\s+\d{1,2},\s+\d{4}/.test(clean(cell.textContent)))
    const valueCell = row.querySelector('td.rechts.hauptlink') || cells.at(-1)
    const name = clean(link.getAttribute('title') || link.textContent)
    if (!name) continue

    players.set(externalId, {
      externalId,
      name,
      profileUrl: canonicalTransfermarktUrl(href, base),
      position,
      dateOfBirth: clean(dateCell?.textContent).replace(/\s*\(.*$/, ''),
      nationality: clean(nationality),
      marketValueEur: parseMarketValue(valueCell?.textContent),
    })
  }

  return [...players.values()]
}

export interface TransfermarktProfile {
  externalId: string
  name: string
  dateOfBirth: string
  placeOfBirth: string
  nationality: string
  secondNationality: string
  heightCm: number
  position: string
  secondaryPositions: string[]
  preferredFoot: string
  shirtNumber: number
  joinedOn: string
  contractExpiresOn: string
  agentName: string
  outfitter: string
  currentTeamExternalId: string
  currentTeamName: string
  imageUrl: string
  marketValueEur: number
  facts: Record<string, string>
}

function profileFacts(html: string): Map<string, string> {
  const document = parseHTML(html)
  const facts = new Map<string, string>()
  const nodes = document.querySelectorAll('.info-table__content')
  for (let index = 0; index + 1 < nodes.length; index += 2) {
    const label = clean(nodes[index]?.textContent).replace(/:$/, '').toLowerCase()
    const value = clean(nodes[index + 1]?.textContent)
    if (label && value) facts.set(label, value)
  }

  // Older profile markup uses list items rather than the info-table pairs.
  for (const item of document.querySelectorAll('.spielerdaten .auflistung li')) {
    const text = clean(item.textContent)
    const separator = text.indexOf(':')
    if (separator > 0)
      facts.set(text.slice(0, separator).trim().toLowerCase(), text.slice(separator + 1).trim())
  }
  return facts
}

export function parseTransfermarktProfile(html: string): TransfermarktProfile {
  const document = parseHTML(html)
  const facts = profileFacts(html)
  const playerLink = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''
  const externalId = playerLink.match(/\/spieler\/(\d+)/)?.[1]
    || html.match(/\/spieler\/(\d+)/)?.[1]
    || ''
  const teamLink = document.querySelector('a[href*="/startseite/verein/"]')
    || document.querySelector('a[href*="/verein/"]')
  const teamHref = teamLink?.getAttribute('href') || ''
  const headline = document.querySelector('h1.data-header__headline-wrapper')
    || document.querySelector('h1')
  const name = clean(headline?.textContent).replace(/^#\d+\s*/, '')
  const height = facts.get('height') || ''
  const nationality = facts.get('citizenship') || facts.get('nationality') || ''
  const citizenship = nationality.split(',').map(clean).filter(Boolean)
  const positions = (facts.get('other position') || facts.get('other positions') || '').split(',').map(clean).filter(Boolean)
  const image = document.querySelector('.data-header__profile-image')?.getAttribute('src')
    || document.querySelector('img[title*="portrait"]')?.getAttribute('src')
    || ''
  const valueText = document.querySelector('.data-header__market-value-wrapper')?.textContent
    || document.querySelector('.right-td .waehrung')?.parent?.textContent
    || ''

  return {
    externalId,
    name,
    dateOfBirth: clean(facts.get('date of birth/age') || facts.get('date of birth')).replace(/\s*\(.*$/, ''),
    placeOfBirth: clean(facts.get('place of birth')),
    nationality: citizenship[0] || '',
    secondNationality: citizenship[1] || '',
    heightCm: Math.round((Number.parseFloat(height.replace(',', '.')) || 0) * (height.includes('m') ? 100 : 1)),
    position: clean(facts.get('position')),
    secondaryPositions: positions,
    preferredFoot: clean(facts.get('foot')),
    shirtNumber: digits(document.querySelector('.data-header__shirt-number')?.textContent),
    joinedOn: clean(facts.get('joined')),
    contractExpiresOn: clean(facts.get('contract expires')),
    agentName: clean(facts.get('player agent') || facts.get('agent')),
    outfitter: clean(facts.get('outfitter')),
    currentTeamExternalId: teamHref.match(/\/verein\/(\d+)/)?.[1] || '',
    currentTeamName: clean(teamLink?.getAttribute('title') || teamLink?.textContent),
    imageUrl: image,
    marketValueEur: parseMarketValue(valueText),
    facts: Object.fromEntries(facts),
  }
}

export interface TransfermarktTransfer {
  externalId: string
  season: string
  transferredOn: string
  fromTeamExternalId: string
  fromTeamName: string
  toTeamExternalId: string
  toTeamName: string
  marketValueEur: number
  feeEur: number
  kind: string
}

export function parseTransfermarktTransfers(html: string): TransfermarktTransfer[] {
  const document = parseHTML(html)
  const result: TransfermarktTransfer[] = []
  const rows = [
    ...document.querySelectorAll('.tm-player-transfer-history-grid'),
    ...document.querySelectorAll('table.items > tbody > tr'),
  ]

  for (const row of rows) {
    const links = row.querySelectorAll('a[href*="/verein/"]')
    if (links.length < 2) continue
    const fromHref = links[0]?.getAttribute('href') || ''
    const toHref = links.at(-1)?.getAttribute('href') || ''
    const texts = row.children.map(child => clean(child.textContent)).filter(Boolean)
    const date = clean(row.querySelector('.tm-player-transfer-history-grid__date')?.textContent)
      || texts.find(text => /\d{1,2}\/\d{1,2}\/\d{2,4}|\w{3}\s+\d{1,2},\s+\d{4}/.test(text))
      || ''
    const season = clean(row.querySelector('.tm-player-transfer-history-grid__season')?.textContent)
      || texts.find(text => /^\d{2}\/\d{2}$/.test(text))
      || ''
    const marketValue = clean(row.querySelector('.tm-player-transfer-history-grid__market-value')?.textContent)
    const feeText = clean(row.querySelector('.tm-player-transfer-history-grid__fee')?.textContent)
      || texts.at(-1)
      || ''
    const fromName = clean(links[0]?.getAttribute('title') || links[0]?.textContent)
    const toName = clean(links.at(-1)?.getAttribute('title') || links.at(-1)?.textContent)
    const fromExternalId = fromHref.match(/\/verein\/(\d+)/)?.[1] || ''
    const toExternalId = toHref.match(/\/verein\/(\d+)/)?.[1] || ''
    // Transfermarkt does not expose a first-class transfer id in this DOM.
    // Derive one from immutable event coordinates; row order and later fee
    // corrections must not manufacture a second career event.
    const identity = createHash('sha256')
      .update([season, date, fromExternalId || fromName, toExternalId || toName].map(clean).join('|'))
      .digest('hex')

    result.push({
      externalId: identity,
      season,
      transferredOn: date,
      fromTeamExternalId: fromExternalId,
      fromTeamName: fromName,
      toTeamExternalId: toExternalId,
      toTeamName: toName,
      marketValueEur: parseMarketValue(marketValue),
      feeEur: parseMarketValue(feeText),
      kind: /loan/i.test(feeText) ? 'loan' : /retired/i.test(feeText) ? 'retirement' : /free transfer/i.test(feeText) ? 'free-transfer' : 'transfer',
    })
  }

  return result
}

export interface TransfermarktInjury {
  injuryType: string
  startedOn: string
  endedOn: string
  daysMissed: number
  gamesMissed: number
}

export function parseTransfermarktInjuries(html: string): TransfermarktInjury[] {
  const document = parseHTML(html)
  return document.querySelectorAll('table.items > tbody > tr').map((row) => {
    const cells = row.children.filter(child => child.tagName.toLowerCase() === 'td').map(cell => clean(cell.textContent))
    return {
      injuryType: cells[0] || '',
      startedOn: cells[1] || '',
      endedOn: cells[2] || '',
      daysMissed: digits(cells.find(value => /day/i.test(value))),
      gamesMissed: digits(cells.at(-1)),
    }
  }).filter(row => row.injuryType.length > 0)
}

export interface TransfermarktSeasonStat {
  season: string
  competition: string
  teamExternalId: string
  teamName: string
  appearances: number
  goals: number
  assists: number
  minutes: number
  metrics: Record<string, string | number>
}

export function parseTransfermarktSeasonStats(html: string): TransfermarktSeasonStat[] {
  const document = parseHTML(html)
  const headers = document.querySelectorAll('table.items > thead th').map(node => clean(node.getAttribute('title') || node.textContent).toLowerCase())
  return document.querySelectorAll('table.items > tbody > tr').map((row) => {
    const cells = row.children.filter(child => child.tagName.toLowerCase() === 'td')
    const values = cells.map(cell => clean(cell.textContent))
    const metrics: Record<string, string | number> = {}
    for (let index = 0; index < values.length; index++)
      metrics[headers[index] || `column_${index + 1}`] = values[index] || ''
    const team = row.querySelector('a[href*="/verein/"]')
    const href = team?.getAttribute('href') || ''
    const pick = (patterns: RegExp[]): string => {
      const index = headers.findIndex(header => patterns.some(pattern => pattern.test(header)))
      return index >= 0 ? values[index] || '' : ''
    }
    return {
      season: pick([/season/]),
      competition: clean(row.querySelector('a[href*="/wettbewerb/"]')?.getAttribute('title') || row.querySelector('a[href*="/wettbewerb/"]')?.textContent),
      teamExternalId: href.match(/\/verein\/(\d+)/)?.[1] || '',
      teamName: clean(team?.getAttribute('title') || team?.textContent),
      appearances: digits(pick([/appear/,/matches/])),
      goals: digits(pick([/^goals?$/])),
      assists: digits(pick([/assist/])),
      minutes: digits(pick([/minute/])),
      metrics,
    }
  }).filter(row => row.season || row.competition)
}

export interface TransfermarktMarketValue {
  valuedOn: string
  valueEur: number
  teamName: string
}

/** Market-value chart points are embedded in profile DOM scripts, not fetched from an API. */
export function parseTransfermarktMarketValues(html: string): TransfermarktMarketValue[] {
  const document = parseHTML(html)
  const scripts = document.querySelectorAll('script').map(script => script.textContent).join('\n')
  const points: TransfermarktMarketValue[] = []
  const objects = scripts.match(/\{[^{}]{0,1200}\}/g) || []

  for (const object of objects) {
    const date = object.match(/(?:^|[{,]\s*)["']?(?:datum_mw|date|datum|x)["']?\s*:\s*["']?([^,"'}]+(?:,\s*\d{4})?)["']?/i)?.[1]
    const value = object.match(/(?:^|[{,]\s*)["']?(?:mw|marketValue|y)["']?\s*:\s*["']?([€\d.,]+(?:bn|m|k)?)["']?/i)?.[1]
    if (!date || !value) continue

    const valueEur = parseMarketValue(value)
    if (valueEur <= 0) continue

    const timestamp = Number(date)
    const valuedOn = Number.isFinite(timestamp) && timestamp >= 1_000_000_000
      ? new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp).toISOString().slice(0, 10)
      : clean(date)
    const teamName = clean(object.match(/(?:^|[{,]\s*)["']?(?:verein|team|club)["']?\s*:\s*["']([^"']*)["']/i)?.[1])
    points.push({ valuedOn, valueEur, teamName })
  }
  return [...new Map(points.map(point => [`${point.valuedOn}:${point.valueEur}`, point])).values()]
}

export interface TransfermarktCareerRecord {
  externalId: string
  title: string
  season: string
  competition: string
  teamExternalId: string
  teamName: string
  occurredOn: string
  endedOn: string
  details: Record<string, unknown>
}

/**
 * Preserve every labeled row from secondary career-history pages. The common
 * fields make records useful immediately; `details` retains the full DOM row
 * so a new sport/provider column never disappears merely because it lacks a
 * first-class PredictHQ attribute yet.
 */
export function parseTransfermarktCareerRecords(html: string, category: string): TransfermarktCareerRecord[] {
  const document = parseHTML(html)
  const records: TransfermarktCareerRecord[] = []

  for (const table of document.querySelectorAll('table')) {
    const headers = table.querySelectorAll('thead th')
      .map(node => clean(node.getAttribute('title') || node.textContent).toLowerCase())
    for (const row of table.querySelectorAll('tbody > tr')) {
      const cells = row.children.filter(child => child.tagName.toLowerCase() === 'td')
      const values = cells.map(cell => clean(cell.textContent))
      if (!values.some(Boolean)) continue

      const details: Record<string, unknown> = {}
      for (let index = 0; index < values.length; index++)
        details[headers[index] || `column_${index + 1}`] = values[index] || ''

      const links = row.querySelectorAll('a[href]').map(link => ({
        label: clean(link.getAttribute('title') || link.textContent),
        url: canonicalTransfermarktUrl(link.getAttribute('href') || ''),
      })).filter(link => link.url)
      if (links.length) details.links = links

      const team = row.querySelector('a[href*="/verein/"]')
      const teamHref = team?.getAttribute('href') || ''
      const competition = row.querySelector('a[href*="/wettbewerb/"]')
      const pick = (patterns: RegExp[]): string => {
        const index = headers.findIndex(header => patterns.some(pattern => pattern.test(header)))
        return index >= 0 ? values[index] || '' : ''
      }
      const dates = values.filter(value => /^\d{1,2}\/\d{1,2}\/\d{2,4}$|^\w{3}\s+\d{1,2},\s+\d{4}$|^\d{4}-\d{2}-\d{2}$/.test(value))
      const title = pick([/title/, /achievement/, /suspension/, /reason/, /shirt/, /number/])
        || clean(competition?.getAttribute('title') || competition?.textContent)
        || values.find(value => !/^\d+$/.test(value))
        || ''
      const identity = createHash('sha256')
        .update(JSON.stringify([category, headers, values, links.map(link => link.url)]))
        .digest('hex')

      records.push({
        externalId: identity,
        title,
        season: pick([/season/]),
        competition: clean(competition?.getAttribute('title') || competition?.textContent || pick([/competition/])),
        teamExternalId: teamHref.match(/\/verein\/(\d+)/)?.[1] || '',
        teamName: clean(team?.getAttribute('title') || team?.textContent),
        occurredOn: pick([/^from$/, /^start/, /^date$/]) || dates[0] || '',
        endedOn: pick([/^until$/, /^end/, /^to$/]) || dates[1] || '',
        details,
      })
    }
  }

  return [...new Map(records.map(record => [record.externalId, record])).values()]
}
