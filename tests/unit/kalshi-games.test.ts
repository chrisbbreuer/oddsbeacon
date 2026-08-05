import { rmSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'bun:test'
import {
  GAME_SERIES,
  parseGameTitle,
  parseOutcomeSide,
  outcomeSideOf,
  seriesTickerOf,
} from '../../app/Services/ingest/kalshi-games'
import { resolveExistingTeam } from '../../app/Services/ingest/resolve'
import { schemaFor } from '../support/schema'

/**
 * Fixtures below are verbatim from Kalshi's public market catalogue, not
 * invented: a parser tested only against strings its author imagined is a
 * parser tested against its own assumptions.
 *
 * The stakes are the mismatch case. `KXEFLCUPGAME-26AUG08WATCRA` is
 * Watford (second tier) against Crawley (fourth), and everything this
 * system could say about that fixture depends on getting from the title
 * to two club rows. A title that almost parses is worse than one that
 * does not, because it silently produces a team called 'Crawley Winner'.
 */

describe('parseGameTitle', () => {
  it('reads a real cup tie', () => {
    expect(parseGameTitle('Watford vs Crawley Winner?')).toEqual({ home: 'Watford', away: 'Crawley' })
  })

  it('reads a real international friendly', () => {
    expect(parseGameTitle('Austria vs Guatemala Winner?')).toEqual({ home: 'Austria', away: 'Guatemala' })
    expect(parseGameTitle('Togo vs Benin Winner?')).toEqual({ home: 'Togo', away: 'Benin' })
  })

  it('keeps multi-word club names whole', () => {
    expect(parseGameTitle('Manchester United vs Crystal Palace Winner?'))
      .toEqual({ home: 'Manchester United', away: 'Crystal Palace' })
  })

  it('does not leave the trailing question in the away team', () => {
    // The bug this guards: a greedy away capture yields 'Crawley Winner'
    // and every downstream lookup silently misses.
    expect(parseGameTitle('Watford vs Crawley Winner?')?.away).toBe('Crawley')
    expect(parseGameTitle('Plymouth vs Exeter Result?')?.away).toBe('Exeter')
    expect(parseGameTitle('Arsenal vs Chelsea To Advance?')?.away).toBe('Chelsea')
  })

  it('tolerates the separator spellings that appear across series', () => {
    expect(parseGameTitle('Ajax v PSV')).toEqual({ home: 'Ajax', away: 'PSV' })
    expect(parseGameTitle('Ajax vs. PSV')).toEqual({ home: 'Ajax', away: 'PSV' })
  })

  it('refuses anything that is not a fixture', () => {
    for (const title of ['', '   ', 'Premier League Top Scorer', 'Will Arsenal win the league?', null, undefined])
      expect(parseGameTitle(title)).toBeNull()
  })

  it('does not split a club whose name contains the separator letter', () => {
    // 'Vs' as a word boundary only, so 'Vitesse' and 'Villa' survive.
    expect(parseGameTitle('Aston Villa vs Vitesse Winner?'))
      .toEqual({ home: 'Aston Villa', away: 'Vitesse' })
  })
})

describe('parseOutcomeSide', () => {
  it('strips the qualifier a cup market carries', () => {
    expect(parseOutcomeSide('Reg Time: Watford')).toBe('Watford')
    expect(parseOutcomeSide('Reg Time: Crawley')).toBe('Crawley')
  })

  it('reads a bare team name unchanged', () => {
    expect(parseOutcomeSide('Guatemala')).toBe('Guatemala')
  })

  it('normalises both wordings for a draw', () => {
    expect(parseOutcomeSide('Tie')).toBe('tie')
    expect(parseOutcomeSide('Reg Time: Tie')).toBe('tie')
    expect(parseOutcomeSide('Draw')).toBe('tie')
  })

  it('is empty-safe', () => {
    expect(parseOutcomeSide('')).toBeNull()
    expect(parseOutcomeSide(null)).toBeNull()
  })
})

describe('seriesTickerOf', () => {
  it('takes the series from a full market ticker', () => {
    expect(seriesTickerOf('KXEFLCUPGAME-26AUG08WATCRA-WAT')).toBe('KXEFLCUPGAME')
    expect(seriesTickerOf('KXINTLFRIENDLYGAME-26JUN11AUTGTM-TIE')).toBe('KXINTLFRIENDLYGAME')
  })

  it('passes a bare series through', () => {
    expect(seriesTickerOf('KXUCLGAME')).toBe('KXUCLGAME')
  })

  it('is empty-safe', () => {
    expect(seriesTickerOf('')).toBe('')
    expect(seriesTickerOf(null)).toBe('')
  })
})

describe('GAME_SERIES', () => {
  it('covers the mismatch series this exists for', () => {
    // Cup and friendly series are the ones that pair divisions.
    expect(GAME_SERIES.KXEFLCUPGAME).toBeDefined()
    expect(GAME_SERIES.KXINTLFRIENDLYGAME).toBeDefined()
    expect(GAME_SERIES.KXCOPADELREYGAME).toBeDefined()
  })

  it('maps every series to a sport that exists in config', () => {
    const known = new Set(['epl', 'laliga', 'seriea', 'bundesliga', 'ucl'])
    for (const [ticker, series] of Object.entries(GAME_SERIES))
      expect({ ticker, ok: known.has(series.sportSlug) }).toEqual({ ticker, ok: true })
  })
})

/**
 * Which outcome a market is, and therefore which way a strength read
 * should point. Getting this backwards is the worst available failure:
 * the signal would argue confidently for the side the evidence is
 * against, so ambiguity has to fail closed rather than pick.
 */
describe('outcomeSideOf', () => {
  const watfordCrawley = { home: 'Watford', away: 'Crawley' }

  it('reads the real cup tie tickers', () => {
    expect(outcomeSideOf('KXEFLCUPGAME-26AUG08WATCRA-WAT', watfordCrawley)).toBe('home')
    expect(outcomeSideOf('KXEFLCUPGAME-26AUG08WATCRA-CRA', watfordCrawley)).toBe('away')
    expect(outcomeSideOf('KXEFLCUPGAME-26AUG08WATCRA-TIE', watfordCrawley)).toBe('tie')
  })

  it('uses the subtitle, which names the side outright', () => {
    const fixture = { home: 'Austria', away: 'Guatemala' }
    expect(outcomeSideOf('KXINTLFRIENDLYGAME-26JUN11AUTGTM-AUT', fixture, 'Austria')).toBe('home')
    expect(outcomeSideOf('KXINTLFRIENDLYGAME-26JUN11AUTGTM-GTM', fixture, 'Guatemala')).toBe('away')
    expect(outcomeSideOf('KXEFLCUPGAME-26AUG08WATCRA-WAT', watfordCrawley, 'Reg Time: Watford')).toBe('home')
  })

  it('declines a FIFA-coded ticker when no subtitle disambiguates it', () => {
    // Kalshi abbreviates clubs by prefix but nations by FIFA code: AUT is
    // Austria, whose first three letters are AUS. Prefix matching cannot
    // resolve that, and a fuzzier rule would eventually resolve one
    // wrongly, so it declines instead.
    const fixture = { home: 'Austria', away: 'Guatemala' }
    expect(outcomeSideOf('KXINTLFRIENDLYGAME-26JUN11AUTGTM-AUT', fixture)).toBeNull()
    expect(outcomeSideOf('KXINTLFRIENDLYGAME-26JUN11AUTGTM-GTM', fixture)).toBeNull()
  })

  it('ignores spaces and punctuation in club names', () => {
    const fixture = { home: 'Manchester United', away: 'Crystal Palace' }
    expect(outcomeSideOf('KXEPLGAME-26AUG08MUNCRY-MAN', fixture)).toBe('home')
  })

  it('fails closed when the suffix matches both sides', () => {
    // Two clubs sharing a prefix in one fixture is rare and real, and
    // guessing between them is the failure this cannot afford.
    expect(outcomeSideOf('KXEPLGAME-26AUG08MANMAN-MAN', { home: 'Manchester City', away: 'Manchester United' })).toBeNull()
  })

  it('fails closed when the suffix matches neither side', () => {
    expect(outcomeSideOf('KXEPLGAME-26AUG08WATCRA-XYZ', watfordCrawley)).toBeNull()
  })

  it('is empty-safe', () => {
    expect(outcomeSideOf('', watfordCrawley)).toBeNull()
    expect(outcomeSideOf(null, watfordCrawley)).toBeNull()
    expect(outcomeSideOf('NOHYPHENS', watfordCrawley)).toBeNull()
  })
})

/**
 * Club-name matching across feeds.
 *
 * Kalshi and ESPN disagree about how much of a club's name to print, and
 * the disagreement lands hardest on exactly the lower-division sides a
 * cup mismatch is about. These run against the real schema because the
 * matching is a query, not a pure function.
 */
describe('resolveExistingTeam', () => {
  const paths: string[] = []

  function db() {
    const path = `tests/temp/resolve-${paths.length}-${Bun.nanoseconds()}.sqlite`
    paths.push(path)
    const database = schemaFor(path, ['sports', 'sports_teams'])
    database.run(`INSERT INTO sports (id, slug, title, grouping, tier, active, position) VALUES (1, 'eng4', 'League Two', 'Soccer', 4, 1, 1)`)
    return database
  }

  afterEach(() => {
    for (const path of paths.splice(0)) {
      for (const suffix of ['', '-shm', '-wal'])
        rmSync(`${path}${suffix}`, { force: true })
    }
  })

  function addTeam(database: ReturnType<typeof db>, id: number, name: string) {
    database.run(
      `INSERT INTO sports_teams (id, sport_id, name, search_key, aliases, created_at, updated_at) VALUES (?, 1, ?, ?, '', '', '')`,
      [id, name, name.toLowerCase().replace(/[^a-z0-9]/g, '')],
    )
  }

  it('matches a shortened club name to its full row', () => {
    const database = db()
    addTeam(database, 10, 'Crawley Town')

    // The case that sent a fourth-division club into the Premier League.
    expect(resolveExistingTeam(database, 1, 'Crawley')).toBe(10)
  })

  it('matches in the other direction too', () => {
    const database = db()
    addTeam(database, 11, 'Watford')

    expect(resolveExistingTeam(database, 1, 'Watford FC')).toBe(11)
  })

  it('refuses an ambiguous containment rather than picking one', () => {
    const database = db()
    addTeam(database, 12, 'Manchester United')
    addTeam(database, 13, 'Newcastle United')

    // 'United' is inside both. Guessing would attach a fixture to the
    // wrong club silently, so it declines.
    expect(resolveExistingTeam(database, 1, 'United')).toBeNull()
  })

  it('returns null for a club it has never seen', () => {
    const database = db()
    addTeam(database, 14, 'Crawley Town')

    expect(resolveExistingTeam(database, 1, 'Real Madrid')).toBeNull()
  })

  it('never creates a row', () => {
    const database = db()
    addTeam(database, 15, 'Barnet')

    resolveExistingTeam(database, 1, 'Some Unknown FC')

    // Inventing a club stamps it with whichever league was being scanned,
    // and a fabricated tier is worse than no tier.
    expect((database.query('SELECT COUNT(*) c FROM sports_teams').get() as any).c).toBe(1)
  })
})
