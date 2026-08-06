import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { Database } from '../Support/db'
import { haltState, setHalt } from '../Services/trading/halt'

/**
 * `buddy trading:halt` — stop every strategy from placing orders.
 *
 * The switch exists to be thrown under pressure, so it is one command
 * with no arguments beyond the reason, it takes effect on every process
 * without a redeploy, and it says plainly what it did. Resuming is a
 * separate command rather than a flag: nobody types the wrong one of two
 * words as fast as they mistype a flag.
 *
 * A deployment-level `TRADING_ENABLED=false` outranks both, and
 * `trading:status` says so rather than letting a resume look like it
 * worked when the environment still refuses.
 */
export default function (cli: CLI) {
  cli
    .command('trading:halt', 'Stop all automated order placement')
    .option('--reason <reason>', 'Why trading is being stopped', { default: '' })
    .option('--actor <actor>', 'Who is stopping it', { default: 'operator' })
    .action(async (options: { reason?: string, actor?: string }) => {
      const db = new Database()

      try {
        await setHalt(db, {
          halted: true,
          reason: options.reason || 'halted from the command line',
          actor: options.actor || 'operator',
        })

        log.success('Trading is halted. No strategy will place an order until it is resumed.')
        log.info('Decisions are still recorded, so the engine\'s reasoning stays visible while it is stopped.')
      }
      catch (error) {
        log.error(`Could not halt trading: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(ExitCode.FatalError)
      }
      finally {
        db.close()
      }
    })

  cli
    .command('trading:resume', 'Allow automated order placement again')
    .option('--actor <actor>', 'Who is resuming it', { default: 'operator' })
    .action(async (options: { actor?: string }) => {
      const db = new Database()

      try {
        await setHalt(db, {
          halted: false,
          reason: 'resumed from the command line',
          actor: options.actor || 'operator',
        })

        const state = await haltState(db)
        if (state.halted) {
          log.warn(`The halt log is clear, but trading is still stopped: ${state.reason}`)
          return
        }

        log.success('Trading is live. Strategies will place orders on their next pass.')
      }
      catch (error) {
        log.error(`Could not resume trading: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(ExitCode.FatalError)
      }
      finally {
        db.close()
      }
    })

  cli
    .command('trading:status', 'Report whether automated trading is live')
    .action(async () => {
      const db = new Database()

      try {
        const state = await haltState(db)

        if (!state.halted) {
          log.success('Trading is live.')
          return
        }

        log.warn(`Trading is halted: ${state.reason}`)
        if (state.actor)
          log.info(`Stopped by ${state.actor}${state.since ? ` at ${state.since}` : ''}.`)
      }
      finally {
        db.close()
      }
    })
}
