import type { RequestLike } from '../../Support/api'
import { freshness, ok, Params } from '../../Support/api'
import { openRead } from '../../Support/db'
import { recentMoves } from '../../Services/quant/movement'

/**
 * GET /api/v1/movements — the most recent line moves across every book.
 */
export default {
  name: 'V1GetMovements',
  description: 'Recent line moves across every bookmaker, newest first.',

  async handle(request?: RequestLike) {
    const params = new Params(request)
    const limit = params.int('limit', { min: 1, max: 200, default: 40 })!

    const invalid = params.invalid()
    if (invalid)
      return invalid

    const db = openRead()
    try {
      return ok(recentMoves(db, limit), {
        request,
        cacheSeconds: 15,
        meta: { freshness: freshness() },
      })
    }
    finally {
      db.close()
    }
  },
}
