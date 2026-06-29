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
 * and push it live on the realtime `alerts` channel. Both paths degrade
 * to no-ops when their backend isn't running, so ingestion never fails on
 * a notification.
 */
export async function alertArbitrage(arb: ArbitrageAlert): Promise<void> {
  try {
    // userId 0 = system-wide alert (no specific recipient).
    await useDatabase().send({ userId: 0, type: 'arbitrage', data: { ...arb } })
  }
  catch { /* notifications table not migrated yet */ }

  try {
    await channel('alerts').public('arbitrage', arb)
  }
  catch { /* no broadcast server running */ }
}
