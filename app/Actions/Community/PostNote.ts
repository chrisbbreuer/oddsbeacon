import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import MarketNote from '../../Models/MarketNote'

/**
 * POST /api/community/notes - leave a note on a market.
 *
 * Signing in is not required to read or to post. A prediction thread that
 * demands an account before the first word is a thread nobody starts, and
 * the note carries a display name either way.
 */
export default new Action({
  name: 'PostNote',
  description: 'Leave a note, with a stance, on one prediction market.',

  async handle(request: any) {
    const marketId = Number(request.get('predictionMarketId'))
    const body = String(request.get('body') ?? '').trim()
    const rawName = String(request.get('authorName') ?? '').trim()
    const rawStance = String(request.get('stance') ?? 'watching').toLowerCase()

    if (!Number.isFinite(marketId) || marketId < 1)
      return response.json({ message: 'A note has to be attached to a market.' }, 422)

    if (!body)
      return response.json({ message: 'The note is empty.' }, 422)

    // Clamp rather than reject. A 1200-character note is someone thinking
    // out loud, not an attack, and losing it to a validation error is worse
    // than storing the first 1000.
    const trimmed = body.slice(0, 1000)

    // Only three stances are countable, so anything else becomes the one
    // that claims least.
    const stance = ['yes', 'no', 'watching'].includes(rawStance) ? rawStance : 'watching'

    const note = await MarketNote.create({
      predictionMarketId: marketId,
      userId: null,
      authorName: rawName.slice(0, 60) || 'Anonymous',
      stance,
      body: trimmed,
      hidden: false,
    })

    return response.json({
      id: note.id,
      authorName: note.authorName,
      stance: note.stance,
      body: note.body,
    }, 201)
  },
})
