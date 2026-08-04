import { route } from '@stacksjs/router'

/**
 * Social sign-in. Served under /api.
 *
 * The stx page server owns the document root and answers any unknown root
 * path with its own 404, so these never reached the API router when they
 * were registered at `/auth/...`. Providers accept whatever callback URL
 * is registered with them, so the prefix is free.
 */
route.get('/auth/{provider}/redirect', 'Actions/Auth/SocialRedirect')
route.get('/auth/{provider}/callback', 'Actions/Auth/SocialCallback')
