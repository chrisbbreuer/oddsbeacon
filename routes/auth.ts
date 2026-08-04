import { route } from '@stacksjs/router'

/**
 * Social sign-in.
 *
 * Served at the app root rather than under /api, because a provider
 * redirects a browser here and the callback URL is registered with the
 * provider by hand. A path under /api would work but reads as a machine
 * endpoint, and this one is walked by a person.
 */
route.get('/auth/{provider}/redirect', 'Actions/Auth/SocialRedirect')
route.get('/auth/{provider}/callback', 'Actions/Auth/SocialCallback')
