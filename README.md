# Prin.tel

**Prediction Intel.** Prin.tel reads the public tape on Kalshi and Polymarket,
scores who keeps buying the side that wins, and turns that into positions — with
every automated decision backed by evidence drawn from our own data.

Built on [Stacks](https://stacksjs.com).

## What it does

**Signals.** Every few minutes the ingestion loop pulls the public trade tape and
market metadata from both venues. Polymarket fills are attributable to a proxy
wallet, so per-account win rates are real there; Kalshi's tape is anonymous, so
its signal is flow rather than identity. Both land in the same normalized shape.

**Odds board.** Sportsbook prices sit next to prediction-market implied
probabilities, so the best available price on each outcome — and any cross-book
arbitrage — is visible on one screen.

**Automated positions.** A strategy states what it will trade and how much. The
decision engine proposes, the evidence behind the proposal is recorded next to it,
and orders reach a venue only when a subscription entitles it.

## Requirements

- **Bun ≥ 1.3.14** — installed and pinned by [Pantry](https://github.com/home-lang/pantry) via `deps.yaml`
- **SQLite ≥ 3.47.2** for local development

## Getting started

```bash
./bootstrap
```

That installs Pantry, the machine dependencies, and the project's packages, then
generates an `APP_KEY`. Afterwards:

```bash
./buddy dev
```

The dev server serves the app at `https://printel.localhost` behind a reverse
proxy that issues a local certificate, with `http://localhost:3000` as a direct
fallback.

## Layout

| Path | What lives here |
| --- | --- |
| `app/Models/` | Bookmakers, markets, selections, odds, prediction markets, traders, trades |
| `app/Services/odds/` | Sportsbook odds providers (TheOddsAPI, synthetic) |
| `app/Services/prediction-markets/` | Kalshi + Polymarket clients and smart-money analytics |
| `app/Actions/` | Query and command handlers, reused by routes, events, and the CLI |
| `app/Jobs/` | Scheduled ingestion and broadcast jobs |
| `app/Support/` | Pure domain logic — odds math, board assembly, branding |
| `routes/` | HTTP routes, registered through `app/Routes.ts` |
| `resources/views/` | stx templates for the board, live feed, and smart money |
| `config/` | Typed configuration, one file per subsystem |

Framework internals live under `storage/framework/` and come from the published
`stacks` package. See [AGENTS.md](./AGENTS.md) for the conventions this project
follows and [DEPLOYMENT.md](./DEPLOYMENT.md) for shipping it.

## Commands

Start the dev server:

```bash
./buddy dev
```

Run the tests:

```bash
./buddy test
```

Lint and auto-fix:

```bash
./buddy lint:fix
```

Type check:

```bash
./buddy typecheck
```

Every Buddy command takes `--help`, and `./buddy --help` lists them all.

## What this is, and is not

Prin.tel is analysis tooling. It surfaces prices, order flow, and historical
accuracy, and it can place orders on venues you have connected with your own
credentials. It does not know what a position is worth to you, and nothing it
produces is financial advice.

## License

MIT — see [LICENSE.md](./LICENSE.md).
