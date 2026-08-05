import type { CLI } from '@stacksjs/types'
import { log } from '@stacksjs/cli'
import { runTransfermarktBackfill } from '../Services/fundamentals/transfermarkt-backfill'

interface BackfillOptions {
  limit?: string | number
  seed?: boolean
  refresh?: boolean
}

export default function (cli: CLI) {
  cli
    .command('transfermarkt:backfill', 'Resume Transfermarkt DOM ingestion and retain raw HTML snapshots')
    .option('--limit <limit>, -l <limit>', 'Maximum queued pages to process', { default: 25 })
    .option('--seed', 'Seed the supported competition discovery tasks', { default: true })
    .option('--refresh', 'Requeue stale current squads and incremental history', { default: false })
    .action(async (options: BackfillOptions) => {
      const limit = Number(options.limit ?? 25)
      if (!Number.isInteger(limit) || limit < 0 || limit > 10_000)
        throw new Error('--limit must be an integer between 0 and 10000')

      const result = await runTransfermarktBackfill({
        limit,
        seed: options.seed !== false,
        refresh: Boolean(options.refresh),
      })
      log.success(`Transfermarkt DOM backfill: ${result.completed} completed, ${result.failed} failed, ${result.remaining} remaining.`)
    })
}
