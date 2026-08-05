import { Database } from '../../Support/db'

interface RequestLike {
  all?: () => Record<string, unknown>
  get?: (key: string) => unknown
  user?: () => Promise<{ id?: number } | null>
}

/**
 * POST /api/sheets — persist a bet sheet (name + legs) for the signed-in
 * user, or against an anonymous browser `token` so guests' sheets survive
 * across devices and can be claimed on sign-up.
 */
export default {
  name: 'SaveSheet',
  description: 'Create a saved bet sheet for a user or anonymous token.',
  // Token/bearer-scoped JSON endpoint (not cookie-form auth) — CSRF N/A.
  skipCsrf: true,

  async handle(request: RequestLike) {
    const all = request?.all?.() ?? {}
    let userId: number | null = null
    try { userId = (await request?.user?.())?.id ?? null }
    catch { userId = null }

    const token = String((all.token ?? request?.get?.('token') ?? '') as string)
    const name = String((all.name ?? 'Untitled sheet') as string) || 'Untitled sheet'
    const legs = Array.isArray(all.legs) ? all.legs as Array<Record<string, unknown>> : []

    if (!userId && !token)
      return { error: 'A user session or token is required' }

    const db = new Database()
    try {
      const parlay = legs.reduce((acc, l) => acc * (Number(l.price) || 1), 1)
      const now = new Date().toISOString()
      const sheetId = await db.transaction(async (transaction) => {
        const { lastInsertRowid } = await transaction
          .prepare('INSERT INTO bet_sheets (user_id, token, name, leg_count, parlay_decimal, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(userId, token || null, name, legs.length, parlay, now)
        const id = Number(lastInsertRowid)
        const insertItem = transaction.prepare('INSERT INTO bet_sheet_items (bet_sheet_id, selection_id, pick, game, league, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        for (const l of legs)
          await insertItem.run(id, Number(l.id) || null, String(l.pick ?? ''), String(l.game ?? ''), String(l.league ?? ''), Number(l.price) || 0, now)
        return id
      })

      return { id: sheetId, name, legCount: legs.length, parlay: Number(parlay.toFixed(2)) }
    }
    finally {
      db.close()
    }
  },
}
