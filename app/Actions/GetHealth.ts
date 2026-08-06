import { Database } from '../Support/db'
import { checkHealth } from '../Services/health'

/**
 * GET /api/health — can this instance serve?
 *
 * Deliberately outside the standard response envelope. The callers are
 * load balancers, container orchestrators, and uptime probes, and they
 * read a status code and at most a shallow field. Wrapping the answer in
 * `data`/`meta` would make every one of them need configuration to find
 * it.
 *
 * Never cached, for the obvious reason.
 */
export default {
  name: 'GetHealth',
  description: 'Liveness of this instance and the dependencies it serves from.',

  async handle() {
    const db = new Database()

    try {
      const health = await checkHealth(db)

      return new Response(JSON.stringify(health), {
        status: health.status === 'down' ? 503 : 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
    }
    finally {
      db.close()
    }
  },
}
