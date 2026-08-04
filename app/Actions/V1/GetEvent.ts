import type { RequestLike } from '../../Support/api'
import { fail, freshness, ok, Params } from '../../Support/api'
import { loadBoard } from '../../Support/odds'

/**
 * GET /api/v1/events/{id} — one event with every market on it.
 *
 * Returns a real 404 when the event does not exist. The previous version
 * returned `{ error: 'Market not found' }` with HTTP 200, which no
 * status-code-checking client could detect — and every client checks the
 * status code.
 */
export default {
  name: 'V1GetEvent',
  description: 'One event, with every market and the books quoting it.',

  async handle(request?: RequestLike) {
    const params = new Params(request)
    const id = params.int('id', { min: 1 })

    const invalid = params.invalid()
    if (invalid)
      return invalid

    if (id === undefined)
      return fail('invalid_request', 'An event id is required', { id: 'required' })

    // One event, so a wide history window is affordable here in a way it
    // is not on the board.
    const board = loadBoard({ limit: 200, historyPoints: 60 })
    const event = board.events.find(e => e.id === id)

    if (!event)
      return fail('not_found', `No event with id ${id}`)

    return ok(
      {
        event,
        bookmakers: board.bookmakers.filter(b => event.bookmakerIds.includes(b.id)),
      },
      { request, cacheSeconds: 20, meta: { freshness: freshness() } },
    )
  },
}
