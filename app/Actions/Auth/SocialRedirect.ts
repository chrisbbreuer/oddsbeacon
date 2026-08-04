import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { AppleProvider, GoogleProvider } from '@stacksjs/socials'

/**
 * GET /auth/{provider}/redirect - start an OAuth sign-in.
 *
 * The provider is resolved from our own config rather than from the
 * request, so an unconfigured provider is a 404 rather than a redirect to
 * a broken authorize URL. That matters: a half-configured provider
 * otherwise sends the user to the provider's error page, which reads to
 * them as our fault and gives them nothing to act on.
 */

const PROVIDERS: Record<string, any> = {
  google: GoogleProvider,
  apple: AppleProvider,
}

export function providerFor(name: string): any | null {
  const Provider = PROVIDERS[name]
  if (!Provider)
    return null

  const settings = (config as any)?.services?.[name]
  // A provider with no client id is not configured, however present its
  // block is. Treat it as absent.
  if (!settings?.clientId || !settings?.clientSecret)
    return null

  return new Provider({
    clientId: String(settings.clientId),
    clientSecret: String(settings.clientSecret),
    redirectUrl: String(settings.redirectUrl ?? ''),
  })
}

export default new Action({
  name: 'SocialRedirect',
  description: 'Send the visitor to a social provider to authenticate.',

  async handle(request: any) {
    const name = String(request.getParam('provider') ?? '').toLowerCase()
    const provider = providerFor(name)

    if (!provider) {
      return response.json({
        message: `${name || 'That provider'} is not configured for sign-in.`,
      }, 404)
    }

    // The state parameter is what ties the callback back to this request;
    // the provider mints and stores it.
    const url = await provider.getAuthUrl()

    return response.redirect(url, 302)
  },
})
