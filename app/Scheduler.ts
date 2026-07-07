import process from 'node:process'
import { schedule } from '@stacksjs/scheduler'

/**
 * **Scheduler**
 *
 * Define your scheduled tasks here. Jobs, actions, and shell commands
 * can all be scheduled with a fluent, expressive API.
 *
 * @see https://docs.stacksjs.com/scheduling
 */
export default function () {
  // Run the Inspire job every hour
  schedule
    .job('Inspire')
    .hourly()
    .setTimeZone('America/Los_Angeles')

  // Live data loop: pull fresh odds, persist with history, and broadcast
  // the refreshed board to realtime subscribers every minute. (IngestOdds
  // broadcasts on completion, so it replaces a standalone BroadcastOdds
  // schedule — that job stays available for a manual re-broadcast.)
  schedule
    .job('IngestOdds')
    .everyMinute()

  // Prediction-market loop: ingest the public Kalshi + Polymarket trade
  // tapes and refresh smart-money analytics (win rates, whale flags).
  schedule
    .job('IngestPredictionMarkets')
    .everyFiveMinutes()

  // Run a custom action every five minutes
  // schedule.action('CleanupTempFiles').everyFiveMinutes()

  // Run a shell command daily at midnight
  // schedule.command('echo "Daily maintenance complete"').daily()
}

process.on('SIGINT', () => {
  schedule.gracefulShutdown().then(() => process.exit(0))
})
