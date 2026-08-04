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

  // The full data loop: fixtures and results from ESPN, then prices, then
  // de-vig and fair value, then feature capture, settlement, calibration,
  // and the AI review. Scheduled as one job rather than several because
  // each stage consumes what the previous one produced, and running them
  // out of order does not fail loudly — it produces subtly stale numbers.
  //
  // See app/Actions/Ingest/RunPipeline.ts for the ordering and why.
  schedule
    .job('RunPipeline')
    .everyFiveMinutes()

  // Prediction-market loop: the public Kalshi and Polymarket trade tapes
  // plus the smart-money analytics over them. Separate from the pipeline
  // above because it reads a different set of venues on its own cadence.
  schedule
    .job('IngestPredictionMarkets')
    .everyFiveMinutes()

  // Trading loop: score markets from that tape, judge the candidates, and
  // place what the active strategies approve. Slower than ingestion on
  // purpose — the evidence window is 24h, so a faster pass mostly
  // re-derives the same numbers. See app/Jobs/AutoTrade.ts.
  schedule
    .job('AutoTrade')
    .everyFifteenMinutes()

  // Run a custom action every five minutes
  // schedule.action('CleanupTempFiles').everyFiveMinutes()

  // Run a shell command daily at midnight
  // schedule.command('echo "Daily maintenance complete"').daily()
}

process.on('SIGINT', () => {
  schedule.gracefulShutdown().then(() => process.exit(0))
})
