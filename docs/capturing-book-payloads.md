# Capturing a bookmaker payload

One adapter per book, each written against a response the book actually
sent. This is the capture half — the part only a human sitting in front of
a browser can do.

## Why a capture is required at all

An adapter written from an assumed payload shape passes its own tests and
fails on first contact. That is worse than no adapter, because the registry
then claims coverage we do not have and the book's absence from the board
looks like a book with nothing to quote.

The DraftKings capture made the case concretely. Three things in that
payload would have been guessed wrong, and each fails silently:

- The response is **relational** — `events`, `markets`, `selections` as
  three flat arrays joined by id, not markets nested inside events.
- The same market is **"Run Line" in MLB and "Spread" in NFL**, sharing one
  `marketType.id`. Keying on the display name drops spreads for every sport
  whose wording nobody enumerated.
- `URLSearchParams` encodes a space as `+`, and that endpoint answers `+`
  inside its filters with a 403 HTML page. It needs `%20`.

None of those are discoverable without the real bytes.

## The recipe

1. Open the book's odds page for a league **that is in season right now**.
   An out-of-season league returns an empty payload, which is
   indistinguishable from a wrong endpoint — you will learn nothing.
2. DevTools → **Network** → filter **Fetch/XHR**.
3. Reload the page.
4. Find the request whose response contains the prices. Sort by size — it
   is usually among the largest JSON responses. Click through and check the
   Response tab actually contains odds, rather than assuming from the URL.
5. Right-click it → **Copy** → **Copy as cURL**.
6. Paste it into the chat.

### Copy as cURL, not the URL

The headers are load-bearing and are the reason this cannot be shortened to
a link. On DraftKings, an identical request returns **200 with a Chrome
user agent and 403 with one naming PredictHQ** — the edge gates on it.
Other headers (`x-client-*`, `sec-*`, origin/referer) were also required;
that was established by removing them one at a time until it refused.

A bare URL loses all of that, and I would spend the next several attempts
rediscovering it.

### If the page needs you signed in

Say so when you paste. A capture that only works with a session cookie is
still useful — it tells us the adapter needs `transport: 'browser'` or a
primed cookie jar rather than a plain JSON fetch — but the cookie itself
should **not** be pasted into the chat. Strip `cookie:` and
`authorization:` headers before sending; note that you removed them.

### More than one capture per book is fine

If the book splits moneyline, spreads and totals across separate requests,
or has a separate call for player props, send each. More shape is better
than less.

## What happens next

Each capture becomes:

- `app/Services/odds/books/<slug>.ts` — the adapter, with an exported pure
  `translate()` so the payload can be tested without a network call
- `tests/fixtures/<slug>-<league>.json` — a trimmed copy of the real
  response
- `tests/unit/<slug>.test.ts` — the translation pinned against that fixture
- one line in `app/Services/odds/books/index.ts`

Then `./buddy odds:watch --once` proves it against the live endpoint, and
`./buddy preflight` stops listing the book as enabled-without-an-adapter.

## The 13 remaining books

Difficulty is an **expectation**, not a measurement — only DraftKings has
actually been done. Take it as where to start, not as a promise.

### Sharp — the highest value per adapter

These anchor the fair-value model, so they are worth more than their count
suggests. `config/odds.ts` already weights them: Pinnacle 4×, Circa 3×,
BetOnline 2× against 1× for a recreational book.

| Book | Where | Notes |
| --- | --- | --- |
| **`pinnacle`** | [pinnacle.com](https://www.pinnacle.com) → any in-season league | **Start here.** The sharpest public line and the best single de-vig anchor. Historically has a clean JSON API behind the site. Also publishes limits, which fills `Odd.limitAmount`. |
| **`circa`** | [circasports.com](https://www.circasports.com) | Sharp, US, high limits. Smaller site, likely a simpler payload. |
| **`betonlineag`** | [betonline.ag](https://www.betonline.ag) | Offshore, no geo gate in most places, so likely the easiest of the three to capture. |

### US majors — the coverage that fills the board

| Book | Where | Notes |
| --- | --- | --- |
| **`fanduel`** | [sportsbook.fanduel.com](https://sportsbook.fanduel.com) | The other half of the US duopoly. Expect an Akamai-style edge like DraftKings — capture all headers. |
| **`betmgm`** | [sports.betmgm.com](https://sports.betmgm.com) | Geo-gated by state; you may need a state in the URL path. |
| **`caesars`** | [sportsbook.caesars.com](https://sportsbook.caesars.com) | Seeded with `providerKey: 'williamhill_us'` — same platform as William Hill US. A capture here may well fit both. |
| **`espnbet`** | [espnbet.com](https://espnbet.com) | Penn/Hollywood platform underneath. |

### Exchanges — back *and* lay, plus real volume

Worth doing even though they are only three books. An exchange price is a
*traded* probability rather than a quote with margin baked in, and
`tradedVolume` is the weight behind it — a price with £4 matched and the
same price with £40,000 matched are not equal evidence.

Lay prices are stored as `marketType: 'h2h_lay'`, which needs no schema
change. When capturing, **grab both sides** — the back and lay ladders are
usually in the same response, but confirm before assuming.

| Book | Where | Notes |
| --- | --- | --- |
| **`betfair`** | [betfair.com/exchange](https://www.betfair.com/exchange) | The deepest exchange. Note it also has an *official* documented API requiring a free application key — if you would rather use that than the site's internal one, say so and I will write the adapter against it instead. That is the cleaner path where a book offers one. |
| **`smarkets`** | [smarkets.com](https://smarkets.com) | Historically the most open API of the three. |
| **`matchbook`** | [matchbook.com](https://www.matchbook.com) | Smaller but genuinely open; has published API docs before. |

### UK/EU — for the ten soccer leagues already in the catalog

| Book | Where | Notes |
| --- | --- | --- |
| **`williamhill`** | [williamhill.com](https://sports.williamhill.com) | See the Caesars note — likely shared platform. |
| **`unibet`** | [unibet.co.uk](https://www.unibet.co.uk) | Kindred group platform, shared with several other brands. |
| **`bet365`** | [bet365.com](https://www.bet365.com) | **Leave until last.** Already marked `transport: 'browser'` in `config/odds.ts` because it is the one book expected to resist a plain fetch — heavy obfuscation and session binding. If the capture turns out to be unusable, the honest outcome is to drop it from the config rather than ship a flaky adapter. |

## A note on what capturing means

These are public, unauthenticated endpoints — the ones each book's own
website calls to draw its own prices. Reading them is not the same as being
licensed to redistribute them, and most books' terms prohibit automated
collection regardless of how public the endpoint is. `/api/v1` reselling
that data onward is a further step again.

The engineering here handles the operational half: per-book token buckets,
conditional requests, and per-book failure recorded rather than swallowed.
It does not resolve the contractual half. Worth a lawyer's eye before the
public API serves this to third parties.

Where a book offers an official API — Betfair does — prefer it. It is
usually less work, it does not break when the site is redesigned, and it is
the version nobody has to argue about.
