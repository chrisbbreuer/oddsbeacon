/**
 * Shared display branding for OddsBeacon — bookmaker "logo" tiles and team
 * badges — used by both the board (`index.stx`) and the live feed
 * (`live.stx`). Team logos are referenced from ESPN's public CDN by URL
 * (not reproduced); the colored chip shows through if one fails to load.
 */

export interface BookBrand { bg: string, fg: string, mark: string, url: string }
export interface TeamBrand { abbr: string, bg: string, fg: string, logo: string }
export interface TeamChip extends TeamBrand { style: string, text: string }

export const bookBrand: Record<string, BookBrand> = {
  draftkings: { bg: '#53d337', fg: '#06230f', mark: 'DK', url: 'https://sportsbook.draftkings.com' },
  fanduel: { bg: '#1493ff', fg: '#ffffff', mark: 'FD', url: 'https://sportsbook.fanduel.com' },
  betmgm: { bg: '#caa64f', fg: '#11130f', mark: 'MGM', url: 'https://sports.betmgm.com' },
  caesars: { bg: '#0d5c43', fg: '#e7c884', mark: 'CZR', url: 'https://www.caesars.com/sportsbook-and-casino' },
  bet365: { bg: '#027b5b', fg: '#ffe400', mark: '365', url: 'https://www.bet365.com' },
  pinnacle: { bg: '#e4022d', fg: '#ffffff', mark: 'PIN', url: 'https://www.pinnacle.com' },
  polymarket: { bg: '#1652f0', fg: '#ffffff', mark: 'PM', url: 'https://polymarket.com' },
  kalshi: { bg: '#00b894', fg: '#06231c', mark: 'KAL', url: 'https://kalshi.com' },
}

export function brandFor(slug: string, short: string): BookBrand {
  return bookBrand[slug] || { bg: '#64748b', fg: '#ffffff', mark: short, url: '#' }
}

const ESPN = 'https://a.espncdn.com/i/teamlogos'
export const teamBrand: Record<string, TeamBrand> = {
  Lakers: { abbr: 'LAL', bg: '#552583', fg: '#fdb927', logo: `${ESPN}/nba/500/lal.png` },
  Celtics: { abbr: 'BOS', bg: '#007a33', fg: '#ffffff', logo: `${ESPN}/nba/500/bos.png` },
  Warriors: { abbr: 'GSW', bg: '#1d428a', fg: '#ffc72c', logo: `${ESPN}/nba/500/gs.png` },
  Nuggets: { abbr: 'DEN', bg: '#0e2240', fg: '#fec524', logo: `${ESPN}/nba/500/den.png` },
  Chiefs: { abbr: 'KC', bg: '#e31837', fg: '#ffb81c', logo: `${ESPN}/nfl/500/kc.png` },
  Bills: { abbr: 'BUF', bg: '#00338d', fg: '#c60c30', logo: `${ESPN}/nfl/500/buf.png` },
  '49ers': { abbr: 'SF', bg: '#aa0000', fg: '#b3995d', logo: `${ESPN}/nfl/500/sf.png` },
  Eagles: { abbr: 'PHI', bg: '#004c54', fg: '#a5acaf', logo: `${ESPN}/nfl/500/phi.png` },
  'Man City': { abbr: 'MCI', bg: '#6cabdd', fg: '#1c2c5b', logo: `${ESPN}/soccer/500/382.png` },
  Arsenal: { abbr: 'ARS', bg: '#ef0107', fg: '#ffffff', logo: `${ESPN}/soccer/500/359.png` },
  Liverpool: { abbr: 'LIV', bg: '#c8102e', fg: '#ffffff', logo: `${ESPN}/soccer/500/364.png` },
  Chelsea: { abbr: 'CHE', bg: '#034694', fg: '#ffffff', logo: `${ESPN}/soccer/500/363.png` },
  Rangers: { abbr: 'NYR', bg: '#0038a8', fg: '#ce1126', logo: `${ESPN}/nhl/500/nyr.png` },
  Bruins: { abbr: 'BOS', bg: '#111111', fg: '#ffb81c', logo: `${ESPN}/nhl/500/bos.png` },
  Dodgers: { abbr: 'LAD', bg: '#005a9c', fg: '#ffffff', logo: `${ESPN}/mlb/500/lad.png` },
  Yankees: { abbr: 'NYY', bg: '#0c2340', fg: '#ffffff', logo: `${ESPN}/mlb/500/nyy.png` },
  Draw: { abbr: 'X', bg: '#94a3b8', fg: '#ffffff', logo: '' },
}

/** Resolve a team chip for a selection label, handling spreads + totals. */
export function teamFor(label: string): TeamChip {
  let base: TeamBrand | undefined = teamBrand[label]
  if (!base && /^(?:over|under)\b/i.test(label)) {
    const over = /^over/i.test(label)
    base = { abbr: over ? 'O' : 'U', bg: over ? '#0a934f' : '#d64550', fg: '#ffffff', logo: '' }
  }
  if (!base) {
    const stripped = label.replace(/\s+[+-]?\d+(?:\.\d+)?$/, '').trim()
    if (teamBrand[stripped])
      base = teamBrand[stripped]
  }
  if (!base)
    base = { abbr: label.slice(0, 3).toUpperCase(), bg: '#64748b', fg: '#ffffff', logo: '' }

  const logo = base.logo || ''
  let style = `background-color:${base.bg};color:${base.fg}`
  if (logo)
    style += `;background-image:url('${logo}');background-size:76%;background-position:center;background-repeat:no-repeat`
  return { ...base, logo, style, text: logo ? '' : base.abbr }
}

export const sportIcon: Record<string, string> = {
  Basketball: '🏀',
  Football: '🏈',
  Soccer: '⚽',
  Hockey: '🏒',
  Baseball: '⚾',
}
