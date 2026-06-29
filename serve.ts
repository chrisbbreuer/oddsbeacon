/**
 * Project views/SSR dev server.
 *
 * The framework's default dev-views harness prefers a local STX worktree
 * (`~/Code/Tools/stx`) when one exists on the machine; on this setup that
 * worktree can't resolve `stx-router`, so `serve()` rejects at boot. This
 * escape hatch (picked up automatically by core/actions/src/dev/views.ts)
 * pins the serve + stx module to the copies vendored in this project's
 * node_modules, then wires the same `/api` + `/docs` proxy the default
 * server provides so form posts and the JSON API resolve in dev.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import process from 'node:process'
import { serve } from 'bun-plugin-stx/serve'

interface RequestContext {
  cookies: Record<string, string>
  url: string
}

const requestStore = new AsyncLocalStorage<RequestContext>()

// Stable global so stx server-script blocks can read request cookies even
// though stx-serve doesn't pass the raw Request into the template context.
;(globalThis as any).requestContext = {
  cookie(name: string): string | null {
    return requestStore.getStore()?.cookies?.[name] ?? null
  },
  url(): string {
    return requestStore.getStore()?.url ?? ''
  },
}

function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {}
  const header = req.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1)
      continue
    const key = trimmed.slice(0, eq).trim()
    if (!key)
      continue
    const value = trimmed.slice(eq + 1).trim()
    try { out[key] = decodeURIComponent(value) }
    catch { out[key] = value }
  }
  return out
}

const port = Number(process.env.PORT) || 3000
const apiBase = `http://127.0.0.1:${Number(process.env.PORT_API) || 3008}`
const docsBase = `http://127.0.0.1:${Number(process.env.PORT_DOCS) || 3006}`

const API_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

async function proxy(req: Request, base: string, stripPrefix?: string): Promise<Response> {
  const incoming = new URL(req.url)
  let pathname = incoming.pathname
  if (stripPrefix && (pathname === stripPrefix || pathname.startsWith(`${stripPrefix}/`)))
    pathname = pathname.slice(stripPrefix.length) || '/'

  const target = `${base}${pathname}${incoming.search}`
  const headers = new Headers(req.headers)
  headers.set('x-forwarded-host', incoming.host)
  try {
    return await fetch(target, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
      redirect: 'manual',
    })
  }
  catch {
    return new Response(`Upstream ${base} unavailable. Start it with \`./buddy dev\`.`, { status: 502 })
  }
}

await serve({
  patterns: ['resources/views', 'storage/framework/defaults/resources/views'],
  port,
  componentsDir: 'storage/framework/defaults/resources/components',
  layoutsDir: 'resources/views/layouts',
  partialsDir: 'resources/views/components',
  fallbackLayoutsDir: 'storage/framework/defaults/resources/layouts',
  fallbackPartialsDir: 'storage/framework/defaults/resources/views',
  quiet: false,
  onRequest: async (req: Request) => {
    const url = new URL(req.url)

    if (url.pathname === '/docs' || url.pathname.startsWith('/docs/'))
      return proxy(req, docsBase, '/docs')

    if (url.pathname.startsWith('/api/') || API_METHODS.has(req.method))
      return proxy(req, apiBase)

    requestStore.enterWith({ cookies: parseCookies(req), url: req.url })
    return null
  },
} as any)
