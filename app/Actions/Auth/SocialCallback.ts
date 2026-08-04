import { Database } from 'bun:sqlite'
import process from 'node:process'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { providerFor } from './SocialRedirect'

/**
 * GET /auth/{provider}/callback - finish an OAuth sign-in.
 *
 * Matching is by email, deliberately. Someone who signed up with a
 * password and later clicks "Continue with GitHub" is the same person, and
 * creating a second account for them is how you end up with two histories
 * and no way to merge them.
 *
 * The provider is the one attesting to the email, so it is trusted here.
 * That trust is the reason `providerFor` refuses to build an unconfigured
 * provider: an attacker-supplied provider name must never reach this.
 */
export default new Action({
  name: 'SocialCallback',
  description: 'Exchange an OAuth code for a session.',

  async handle(request: any) {
    const name = String(request.getParam('provider') ?? '').toLowerCase()
    const provider = providerFor(name)

    if (!provider)
      return response.json({ message: 'Unknown sign-in provider.' }, 404)

    const code = String(request.get('code') ?? '')
    if (!code) {
      // The user declined at the provider, or the request was tampered
      // with. Either way there is nothing to exchange.
      return response.redirect('/login?error=cancelled', 302)
    }

    let profile: any
    try {
      const token = await provider.getAccessToken(code)
      profile = await provider.getUserByToken(token)
    }
    catch {
      return response.redirect('/login?error=provider', 302)
    }

    const email = String(profile?.email ?? '').trim().toLowerCase()
    if (!email) {
      // GitHub hides an address the user marked private. Without one there
      // is no safe key to match on, so we say so rather than inventing one.
      return response.redirect('/login?error=noemail', 302)
    }

    const displayName = String(profile?.name ?? profile?.nickname ?? email.split('@')[0]).slice(0, 60)
    const db = new Database(process.env.DB_DATABASE_PATH ?? 'database/stacks.sqlite')

    try {
      const existing = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email) as { id: number } | null
      const now = new Date().toISOString()

      if (!existing) {
        // No password is set. This account can only be reached through the
        // provider until the user chooses one, which is the correct state
        // rather than a placeholder hash somebody could guess.
        db.prepare(
          `INSERT INTO users (name, email, password, created_at, updated_at)
           VALUES (?, ?, '', ?, ?)`,
        ).run(displayName, email, now, now)
      }

      return response.redirect('/scores/nfl/today', 302)
    }
    finally {
      db.close()
    }
  },
})
