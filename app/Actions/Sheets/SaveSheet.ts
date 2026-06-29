import { Database } from 'bun:sqlite'
import process from 'node:process'

function dbPath(): string {
  const p = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return p.startsWith('/') ? p : `${process.cwd()}/${p}`
}

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

    const db = new Database(dbPath())
    try {
      const parlay = legs.reduce((acc, l) => acc * (Number(l.price) || 1), 1)
      const now = new Date().toISOString()
      const { lastInsertRowid } = db
        .prepare('INSERT INTO bet_sheets (user_id, token, name, leg_count, parlay_decimal, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, token || null, name, legs.length, parlay, now)
      const sheetId = Number(lastInsertRowid)

      const insertItem = db.prepare('INSERT INTO bet_sheet_items (bet_sheet_id, selection_id, pick, game, league, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const l of legs) {
        insertItem.run(sheetId, Number(l.id) || null, String(l.pick ?? ''), String(l.game ?? ''), String(l.league ?? ''), Number(l.price) || 0, now)
      }

      return { id: sheetId, name, legCount: legs.length, parlay: Number(parlay.toFixed(2)) }
    }
    finally {
      db.close()
    }
  },
}
