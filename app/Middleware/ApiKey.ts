import { HttpError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { Middleware } from '@stacksjs/router'
import { Database } from '../Support/db'
import { meter, resolveKey } from '../Services/api-keys'

/**
 * API key authentication and metering.
 *
 * Two modes, chosen per route:
 *
 *   `apikey` — a key is optional. When one is presented it is verified,
 *   metered, and held to the quota of the plan behind it. When none is,
 *   the request proceeds anonymously under the per-IP throttle it always
 *   had. Existing callers keep working, and callers who identify
 *   themselves get an allowance that follows what they pay.
 *
 *   `apikey:required` — no key, no answer. Reserved for the endpoints
 *   whose cost is high enough that serving them to an unknown caller is
 *   the problem, which today means the bulk export.
 *
 * A presented key that is wrong is always rejected, in both modes. The
 * optional mode is about not requiring one, never about ignoring a bad
 * one — quietly downgrading a failed key to anonymous access would make
 * a revoked key look like it still worked.
 */
export default new Middleware({
  name: 'ApiKey',
  // After throttle, before the handler: a request that the per-IP limit
  // is going to reject should not cost a database round trip first.
  priority: 2,

  async handle(request: any) {
    const required = request._middlewareParams?.apikey === 'required'
    const presented = request.bearerToken?.() ?? request.header?.('x-api-key') ?? ''

    if (!presented) {
      if (required)
        throw new HttpError(401, 'This endpoint requires an API key. Create one under your account.')

      return
    }

    const db = new Database()

    try {
      const key = await resolveKey(db, String(presented))

      if (!key) {
        // Deliberately the same message for malformed, unknown, and
        // revoked. Distinguishing them tells someone probing which of
        // their guesses was closer.
        throw new HttpError(401, 'That API key is not valid.')
      }

      const endpoint = String(request.routePattern ?? request.path ?? 'unknown')
      const { used, allowed } = await meter(db, key, endpoint)

      if (!allowed) {
        throw new HttpError(
          429,
          `Daily quota of ${key.dailyQuota} requests reached for the ${key.tier} plan (${used} used). It resets at midnight UTC.`,
        )
      }

      // Downstream actions read the caller from the request, the same
      // way they would a signed-in session.
      request.user = { id: key.userId }
      request.apiKey = { id: key.id, prefix: key.prefix, tier: key.tier }

      log.debug(`[middleware:apikey] ${key.prefix} on ${endpoint} (${used} today)`)
    }
    finally {
      db.close()
    }
  },
})
