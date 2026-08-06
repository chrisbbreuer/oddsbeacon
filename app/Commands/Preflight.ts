import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { auditVitessMigrations, keyspaceIsSharded } from '../Services/schema'

/**
 * `buddy preflight` — what will this deployment actually be able to do?
 *
 * Every one of these is optional in the sense that the app boots without
 * it, and that is the problem. A production deploy with no `ODDS_API_KEY`
 * comes up serving a simulator, with no sign-in provider it comes up with
 * a login page nobody can use, and both look exactly like a healthy boot
 * in the logs. The failure surfaces days later as "why does the board
 * never move", which is a bad way to find out.
 *
 * Run before cutting over, and again after. Exits non-zero when something
 * required for the target environment is missing, so a deploy script can
 * gate on it.
 */

interface Check {
  key: string
  label: string
  /** What silently degrades when this is absent. */
  consequence: string
  /** Required in production. Absent elsewhere is normal. */
  requiredInProduction: boolean
  /** Extra keys that must all be present for the feature to work. */
  companions?: string[]
}

const CHECKS: Check[] = [
  {
    key: 'APP_KEY',
    label: 'Application key',
    consequence: 'Encryption and signed values are unsafe without it.',
    requiredInProduction: true,
  },
  {
    key: 'ODDS_API_KEY',
    label: 'Live odds feed',
    consequence: 'Every price falls back to the built-in simulator, and every edge on the site is fictional.',
    requiredInProduction: true,
  },
  {
    key: 'ANTHROPIC_API_KEY',
    label: 'AI review',
    consequence: 'Candidates are never reviewed, so decisions carry no written reasoning.',
    requiredInProduction: false,
  },
  {
    key: 'GOOGLE_CLIENT_ID',
    label: 'Google sign-in',
    consequence: 'The button is hidden and nobody can create an account with Google.',
    requiredInProduction: false,
    companions: ['GOOGLE_CLIENT_SECRET'],
  },
  {
    key: 'APPLE_CLIENT_ID',
    label: 'Apple sign-in',
    consequence: 'The button is hidden and nobody can create an account with Apple.',
    requiredInProduction: false,
    companions: ['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'],
  },
]

interface Result {
  check: Check
  present: boolean
  /** Keys the feature needs that are missing, when partially configured. */
  missingCompanions: string[]
}

export function evaluateChecks(env: Record<string, string | undefined> = process.env): Result[] {
  return CHECKS.map((check) => {
    const present = Boolean(env[check.key])
    const missingCompanions = present
      ? (check.companions ?? []).filter(key => !env[key])
      : []

    return { check, present, missingCompanions }
  })
}

/** A half-configured provider is worse than an absent one: it looks done. */
export function isBroken(result: Result): boolean {
  return result.present && result.missingCompanions.length > 0
}

export function failures(results: Result[], isProduction: boolean): Result[] {
  return results.filter(r => isBroken(r) || (isProduction && r.check.requiredInProduction && !r.present))
}

export default function (cli: CLI) {
  cli
    .command('preflight', 'Report what this deployment can actually do')
    .option('--production, -p', 'Treat missing production requirements as failures', { default: false })
    .action((options: { production?: boolean }) => {
      const appEnv = process.env.APP_ENV ?? 'local'
      const isProduction = options.production || appEnv === 'production'
      const results = evaluateChecks()

      console.log(`\n  Preflight — ${appEnv}\n`)

      for (const result of results) {
        const { check } = result
        if (isBroken(result)) {
          console.log(`  ✗ ${check.label} is half configured`)
          console.log(`     ${check.key} is set but ${result.missingCompanions.join(', ')} ${result.missingCompanions.length === 1 ? 'is' : 'are'} not.`)
          continue
        }

        if (result.present) {
          console.log(`  ✓ ${check.label}`)
          continue
        }

        const required = isProduction && check.requiredInProduction
        console.log(`  ${required ? '✗' : '·'} ${check.label} is not configured`)
        console.log(`     ${check.consequence}`)
        console.log(`     Set ${[check.key, ...(check.companions ?? [])].join(', ')}.`)
      }

      // The schema half of the same question. An env key that is missing
      // announces itself the first time a feature is used; a table that
      // cannot allocate an id announces itself the first time someone
      // writes to it, which on this deployment means mid-trade.
      const sharded = keyspaceIsSharded()
      const schemaProblems = process.env.DB_CONNECTION === 'vitess' ? auditVitessMigrations() : []

      if (process.env.DB_CONNECTION === 'vitess') {
        console.log('')
        if (schemaProblems.length === 0) {
          console.log(`  ✓ Vitess migrations match a ${sharded ? 'sharded' : 'single unsharded'} keyspace`)
        }
        else {
          console.log(`  ✗ ${schemaProblems.length} Vitess ${schemaProblems.length === 1 ? 'table does' : 'tables do'} not match a ${sharded ? 'sharded' : 'single unsharded'} keyspace`)
          for (const problem of schemaProblems)
            console.log(`     ${problem.table} ${problem.detail}`)
        }
      }

      const failed = failures(results, isProduction)
      console.log('')

      if (failed.length === 0 && schemaProblems.length === 0) {
        log.success(isProduction
          ? 'Ready for production.'
          : 'Nothing is broken. Unset keys above are optional outside production.')
        return
      }

      const total = failed.length + schemaProblems.length
      log.error(`${total} ${total === 1 ? 'problem' : 'problems'} would ship silently. Fix them or deploy knowingly.`)
      process.exit(ExitCode.FatalError)
    })
}
