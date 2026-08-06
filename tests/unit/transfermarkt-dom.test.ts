import { describe, expect, test } from 'bun:test'
import { databaseTimestamp } from '../../app/Services/fundamentals/transfermarkt-backfill'
import {
  parseTransfermarktCareerRecords,
  parseTransfermarktInjuries,
  parseTransfermarktMarketValues,
  parseTransfermarktProfile,
  parseTransfermarktSeasonStats,
  parseTransfermarktSquad,
  parseTransfermarktTransfers,
} from '../../app/Services/fundamentals/transfermarkt-dom'

describe('Transfermarkt DOM parsers', () => {
  test('formats queue timestamps for MySQL DATETIME columns', () => {
    expect(databaseTimestamp(new Date('2026-08-06T07:15:42.171Z'))).toBe('2026-08-06 07:15:42')
  })

  test('discovers squad player identities from the rendered club table', () => {
    const html = `<table class="items"><tbody><tr>
      <td><table class="inline-table"><tr><td><a title="Ada Striker" href="/ada-striker/profil/spieler/42">Ada</a></td></tr><tr><td>Centre-Forward</td></tr></table></td>
      <td>Jun 1, 2000 (26)</td><td><img class="flaggenrahmen" title="England"></td>
      <td class="rechts hauptlink">€12.50m</td>
    </tr></tbody></table>`
    expect(parseTransfermarktSquad(html)).toEqual([{
      externalId: '42', name: 'Ada Striker', profileUrl: 'https://www.transfermarkt.com/ada-striker/profil/spieler/42',
      position: 'Centre-Forward', dateOfBirth: 'Jun 1, 2000', nationality: 'England', marketValueEur: 12_500_000,
    }])
  })

  test('reads profile facts from DOM labels instead of positional API fields', () => {
    const html = `<link rel="canonical" href="https://www.transfermarkt.com/ada/profil/spieler/42">
      <h1 class="data-header__headline-wrapper">#9 Ada Striker</h1>
      <img class="data-header__profile-image" src="https://img.example/42.jpg">
      <span class="data-header__shirt-number">#9</span>
      <a title="Example FC" href="/example-fc/startseite/verein/7">Example FC</a>
      <div class="data-header__market-value-wrapper">€12.50m</div>
      <div class="info-table">
        <span class="info-table__content">Date of birth/age:</span><span class="info-table__content">Jun 1, 2000 (26)</span>
        <span class="info-table__content">Place of birth:</span><span class="info-table__content">London</span>
        <span class="info-table__content">Citizenship:</span><span class="info-table__content">England, Ireland</span>
        <span class="info-table__content">Height:</span><span class="info-table__content">1,82 m</span>
        <span class="info-table__content">Position:</span><span class="info-table__content">Centre-Forward</span>
        <span class="info-table__content">Foot:</span><span class="info-table__content">left</span>
        <span class="info-table__content">Joined:</span><span class="info-table__content">Jul 1, 2024</span>
        <span class="info-table__content">Contract expires:</span><span class="info-table__content">Jun 30, 2029</span>
        <span class="info-table__content">Player agent:</span><span class="info-table__content">Example Sports</span>
        <span class="info-table__content">Outfitter:</span><span class="info-table__content">Boot Co</span>
      </div>`
    expect(parseTransfermarktProfile(html)).toMatchObject({
      externalId: '42', name: 'Ada Striker', dateOfBirth: 'Jun 1, 2000', placeOfBirth: 'London',
      nationality: 'England', secondNationality: 'Ireland', heightCm: 182, position: 'Centre-Forward',
      preferredFoot: 'left', shirtNumber: 9, currentTeamExternalId: '7', currentTeamName: 'Example FC', marketValueEur: 12_500_000,
      joinedOn: 'Jul 1, 2024', contractExpiresOn: 'Jun 30, 2029', agentName: 'Example Sports', outfitter: 'Boot Co',
      facts: { 'player agent': 'Example Sports', outfitter: 'Boot Co' },
    })
  })

  test('parses transfers, injuries, generic season metrics, and embedded value history', () => {
    const transfers = `<div class="tm-player-transfer-history-grid">
      <div class="tm-player-transfer-history-grid__season">25/26</div><div class="tm-player-transfer-history-grid__date">Jul 1, 2025</div>
      <a title="From FC" href="/from/verein/1">From FC</a><a title="To FC" href="/to/verein/2">To FC</a>
      <div class="tm-player-transfer-history-grid__market-value">€10.00m</div><div class="tm-player-transfer-history-grid__fee">loan transfer</div>
    </div>`
    const transfer = parseTransfermarktTransfers(transfers)[0]
    expect(transfer).toMatchObject({ season: '25/26', fromTeamExternalId: '1', toTeamExternalId: '2', kind: 'loan' })
    expect(parseTransfermarktTransfers(`<div class="tm-player-transfer-history-grid">${transfers}<div></div></div>${transfers}`)[0]?.externalId).toBe(transfer?.externalId)

    const injuries = `<table class="items"><tbody><tr><td>Hamstring injury</td><td>Jan 1, 2025</td><td>Jan 20, 2025</td><td>19 days</td><td>4</td></tr></tbody></table>`
    expect(parseTransfermarktInjuries(injuries)[0]).toEqual({ injuryType: 'Hamstring injury', startedOn: 'Jan 1, 2025', endedOn: 'Jan 20, 2025', daysMissed: 19, gamesMissed: 4 })

    const stats = `<table class="items"><thead><tr><th>Season</th><th>Club</th><th>Appearances</th><th>Goals</th><th>Assists</th><th>Minutes</th></tr></thead><tbody><tr>
      <td>25/26</td><td><a title="To FC" href="/to/verein/2">To FC</a><a title="Premier League" href="/premier/wettbewerb/GB1">PL</a></td><td>30</td><td>18</td><td>7</td><td>2.340'</td>
    </tr></tbody></table>`
    expect(parseTransfermarktSeasonStats(stats)[0]).toMatchObject({ season: '25/26', teamExternalId: '2', appearances: 30, goals: 18, assists: 7, minutes: 2340 })

    const values = `<script>var chart = [{"datum_mw":"2025-01-01","mw":"12.50m"},{"datum_mw":"2025-06-01","mw":"15.00m"}]</script>`
    expect(parseTransfermarktMarketValues(values).map(point => point.valueEur)).toEqual([12_500_000, 15_000_000])

    const numericValues = `<script>window.chart = [{ x: 1735689600000, y: 16000000, verein: "To FC" }]</script>`
    expect(parseTransfermarktMarketValues(numericValues)).toEqual([{ valuedOn: '2025-01-01', valueEur: 16_000_000, teamName: 'To FC' }])
  })

  test('retains complete labeled rows from secondary career-history DOM', () => {
    const html = `<table class="items"><thead><tr><th>Season</th><th>Competition</th><th>Club</th><th>Achievement</th></tr></thead><tbody><tr>
      <td>24/25</td><td><a title="Premier League" href="/premier-league/startseite/wettbewerb/GB1">PL</a></td>
      <td><a title="Example FC" href="/example/startseite/verein/7">Example</a></td><td>Champion</td>
    </tr></tbody></table>`
    const record = parseTransfermarktCareerRecords(html, 'achievements')[0]
    expect(record).toMatchObject({
      season: '24/25', competition: 'Premier League', teamExternalId: '7', teamName: 'Example FC', title: 'Champion',
      details: { season: '24/25', achievement: 'Champion' },
    })
    expect(record?.externalId).toHaveLength(64)
    expect((record?.details.links as unknown[])).toHaveLength(2)
  })
})
