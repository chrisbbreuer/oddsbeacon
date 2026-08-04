import { describe, expect, it } from 'bun:test'
import { fail, ok, paginate, Params, weakEtag } from '../../app/Support/api'

/**
 * The API contract, pinned.
 *
 * These cover the guarantees a consumer actually relies on: that an error
 * carries the HTTP status its code implies, that a bad parameter is named
 * rather than silently coerced, and that a cached response can be
 * revalidated. Each of those was previously broken in a way that looked
 * like success from the outside.
 */

async function json(res: Response): Promise<any> {
  return await res.json()
}

describe('ok', () => {
  it('wraps data in the envelope with a timestamp', async () => {
    const res = ok({ hello: 'world' })
    expect(res.status).toBe(200)

    const body = await json(res)
    expect(body.data).toEqual({ hello: 'world' })
    expect(typeof body.meta.at).toBe('string')
  })

  it('returns a real Response so the router does not re-wrap it', () => {
    // Returning a plain object had the router JSON-encode it and drop the
    // status and headers, nesting the envelope inside another one.
    expect(ok({})).toBeInstanceOf(Response)
    expect(fail('not_found', 'x')).toBeInstanceOf(Response)
  })

  it('does not cache unless asked to', () => {
    expect(ok({}).headers.get('cache-control')).toBe('no-store')
    expect(ok({}).headers.get('etag')).toBeNull()
  })

  it('sets cache-control and an ETag when a lifetime is given', () => {
    const res = ok({ a: 1 }, { cacheSeconds: 30 })
    expect(res.headers.get('cache-control')).toContain('max-age=30')
    expect(res.headers.get('etag')).toBeTruthy()
  })

  it('tags on data alone, so meta.at does not defeat revalidation', () => {
    // Two responses generated at different instants carry the same data
    // and must therefore share a tag — otherwise no conditional request
    // could ever match and the ETag would be decorative.
    const a = ok({ a: 1 }, { cacheSeconds: 30 })
    const b = ok({ a: 1 }, { cacheSeconds: 30 })
    expect(a.headers.get('etag')).toBe(b.headers.get('etag')!)
  })

  it('answers 304 when the inbound tag matches', async () => {
    const etag = weakEtag({ a: 1 })
    const res = ok({ a: 1 }, {
      cacheSeconds: 30,
      request: { headers: new Headers({ 'if-none-match': etag }) },
    })

    expect(res.status).toBe(304)
    expect(await res.text()).toBe('')
  })

  it('serves a full response when the tag does not match', () => {
    const res = ok({ a: 1 }, {
      cacheSeconds: 30,
      request: { headers: new Headers({ 'if-none-match': 'W/"stale"' }) },
    })
    expect(res.status).toBe(200)
  })

  it('includes pagination when given', async () => {
    const res = ok([], { pagination: paginate(100, 10, 0) })
    const body = await json(res)
    expect(body.pagination).toEqual({ total: 100, limit: 10, offset: 0, hasMore: true })
  })
})

describe('fail', () => {
  it('maps each code to its HTTP status', () => {
    // A "not found" that answers 200 is invisible to every client that
    // checks the status code, which is every client.
    expect(fail('not_found', 'x').status).toBe(404)
    expect(fail('invalid_request', 'x').status).toBe(422)
    expect(fail('unauthorized', 'x').status).toBe(401)
    expect(fail('rate_limited', 'x').status).toBe(429)
    expect(fail('internal', 'x').status).toBe(500)
  })

  it('carries a machine-readable code and field details', async () => {
    const body = await json(fail('invalid_request', 'Bad', { limit: 'must be an integer' }))
    expect(body.error.code).toBe('invalid_request')
    expect(body.error.details.limit).toBe('must be an integer')
  })

  it('is never cached', () => {
    expect(fail('not_found', 'x').headers.get('cache-control')).toBe('no-store')
  })
})

describe('paginate', () => {
  it('reports hasMore only while a page remains', () => {
    expect(paginate(100, 10, 0).hasMore).toBe(true)
    expect(paginate(100, 10, 90).hasMore).toBe(false)
    expect(paginate(5, 10, 0).hasMore).toBe(false)
  })
})

describe('Params', () => {
  const request = (values: Record<string, unknown>) => ({ get: (k: string) => values[k] })

  it('reads strings and integers', () => {
    const p = new Params(request({ sport: 'nba', limit: '25' }))
    expect(p.string('sport')).toBe('nba')
    expect(p.int('limit')).toBe(25)
    expect(p.invalid()).toBeNull()
  })

  it('falls back to defaults when absent', () => {
    const p = new Params(request({}))
    expect(p.int('limit', { default: 50 })).toBe(50)
    expect(p.string('sport')).toBeUndefined()
    expect(p.invalid()).toBeNull()
  })

  it('rejects a non-numeric integer instead of yielding NaN', () => {
    // `Number('abc')` is NaN, which previously flowed into the query and
    // surfaced as an empty result rather than as a bad request.
    const p = new Params(request({ limit: 'abc' }))
    p.int('limit', { default: 50 })

    const invalid = p.invalid()
    expect(invalid).not.toBeNull()
    expect(invalid!.status).toBe(422)
  })

  it('enforces bounds', () => {
    const p = new Params(request({ limit: '9999' }))
    p.int('limit', { min: 1, max: 200, default: 50 })
    expect(p.invalid()).not.toBeNull()
  })

  it('enforces an allow-list', () => {
    const p = new Params(request({ status: 'nonsense' }))
    p.string('status', { allow: ['scheduled', 'live'] })
    expect(p.invalid()).not.toBeNull()
  })

  it('normalizes an instant and rejects an unparseable one', () => {
    const good = new Params(request({ from: '2026-08-04T12:00:00Z' }))
    expect(good.instant('from')).toBe('2026-08-04T12:00:00.000Z')
    expect(good.invalid()).toBeNull()

    const bad = new Params(request({ from: 'not-a-date' }))
    bad.instant('from')
    expect(bad.invalid()).not.toBeNull()
  })

  it('names every failing field at once', async () => {
    const p = new Params(request({ limit: 'abc', status: 'nope' }))
    p.int('limit')
    p.string('status', { allow: ['scheduled'] })

    const body = await json(p.invalid()!)
    expect(Object.keys(body.error.details).sort()).toEqual(['limit', 'status'])
  })
})
