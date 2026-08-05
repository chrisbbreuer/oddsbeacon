import { describe, expect, it } from 'bun:test'
import commands from '../../app/Commands'

describe('production commands', () => {
  it('registers the resumable database import and Transfermarkt backfill', () => {
    expect(commands['database:import-legacy']).toBe('ImportLegacyDatabase')
    expect(commands['transfermarkt:backfill']).toBe('TransfermarktBackfill')
  })
})
