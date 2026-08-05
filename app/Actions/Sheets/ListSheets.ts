import { Database } from '../../Support/db'

interface RequestLike {
  get?: (key: string) => unknown
  user?: () => Promise<{ id?: number } | null>
}

/**
 * GET /api/sheets?token=… — the saved bet sheets (with their legs) for the
 * signed-in user, or for an anonymous browser token.
 */
export default {
  name: 'ListSheets',
  description: 'List saved bet sheets for a user or anonymous token.',

  async handle(request: RequestLike) {
    let userId: number | null = null
    try { userId = (await request?.user?.())?.id ?? null }
    catch { userId = null }
    const token = String((request?.get?.('token') ?? '') as string)

    if (!userId && !token)
      return { sheets: [] }

    const db = new Database()
    try {
      const sheets = await (userId
        ? db.query('SELECT id, name, leg_count, parlay_decimal FROM bet_sheets WHERE user_id = ?1 ORDER BY id DESC').all(userId)
        : db.query('SELECT id, name, leg_count, parlay_decimal FROM bet_sheets WHERE token = ?1 ORDER BY id DESC').all(token))

      const itemStmt = db.query('SELECT selection_id, pick, game, league, price FROM bet_sheet_items WHERE bet_sheet_id = ?1')
      return {
        sheets: await Promise.all(sheets.map(async s => ({
          id: s.id,
          name: s.name,
          legCount: s.leg_count,
          parlay: s.parlay_decimal,
          legs: await itemStmt.all(s.id as number),
        }))),
      }
    }
    finally {
      db.close()
    }
  },
}
