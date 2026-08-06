import { log } from '@stacksjs/logging'
import { useDatabase } from '@stacksjs/notifications'
import { channel } from '@stacksjs/realtime'

export interface ArbitrageAlert {
  marketId: number
  title: string
  league: string
  profitPct: number
  legs: Array<{ pick: string, book: string, price: number }>
}

/**
 * Fire an alert when a fresh cross-book arbitrage appears: persist it as a
 * database notification (visible in the dashboard / notifications table)
 * and push it live on the realtime `alerts` channel.
 *
 * Neither path is allowed to fail ingestion — an alert is worth less than
 * the pass that produced it — but neither is allowed to fail silently
 * either. Both failures used to be swallowed by a bare catch, so a
 * notifications table that had stopped accepting writes and a broadcast
 * server that was never running produced identical output: none.
 */
export async function alertArbitrage(arb: ArbitrageAlert): Promise<void> {
  try {
    // userId 0 = system-wide alert (no specific recipient).
    await useDatabase().send({ userId: 0, type: 'arbitrage', data: { ...arb } })
  }
  catch (error) {
    log.warn(`[alerts] could not record the arbitrage on ${arb.title}: ${message(error)}`)
  }

  try {
    await channel('alerts').public('arbitrage', arb)
  }
  catch (error) {
    log.warn(`[alerts] could not broadcast the arbitrage on ${arb.title}: ${message(error)}`)
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
