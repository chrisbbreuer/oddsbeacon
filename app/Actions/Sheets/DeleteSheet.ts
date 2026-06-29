import { Database } from 'bun:sqlite'
import process from 'node:process'

function dbPath(): string {
  const p = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return p.startsWith('/') ? p : `${process.cwd()}/${p}`
}

interface RequestLike {
  get?: (key: string) => unknown
  user?: () => Promise<{ id?: number } | null>
}

/**
 * DELETE /api/sheets/{id} — remove a saved sheet (and its legs), but only
 * if it belongs to the requesting user or token.
 */
export default {
  name: 'DeleteSheet',
  description: 'Delete a saved bet sheet owned by the requester.',
  // Token/bearer-scoped JSON endpoint (not cookie-form auth) — CSRF N/A.
  skipCsrf: true,

  async handle(request: RequestLike) {
    const id = Number(request?.get?.('id'))
    const token = String((request?.get?.('token') ?? '') as string)
    let userId: number | null = null
    try { userId = (await request?.user?.())?.id ?? null }
    catch { userId = null }

    if (!id)
      return { error: 'Missing sheet id' }

    const db = new Database(dbPath())
    try {
      const owned = db
        .query('SELECT id FROM bet_sheets WHERE id = ?1 AND (token = ?2 OR (user_id IS NOT NULL AND user_id = ?3))')
        .get(id, token || null, userId)
      if (!owned)
        return { error: 'Sheet not found', id }

      db.run('DELETE FROM bet_sheet_items WHERE bet_sheet_id = ?1', [id])
      db.run('DELETE FROM bet_sheets WHERE id = ?1', [id])
      return { deleted: id }
    }
    finally {
      db.close()
    }
  },
}
