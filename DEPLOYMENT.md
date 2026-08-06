# Deploying Prin.tel

Prin.tel is a standard Stacks app plus a realtime broadcast server and a
scheduled ingestion loop. Build and ship it with Buddy.

## Environment

Set these in `.env` (production values in `.env.production`):

| Var | Purpose |
| --- | --- |
| `APP_URL` | Public domain. A custom domain enables HTTPS pretty URLs in dev via rpx. |
| `DB_CONNECTION` / `DB_DATABASE_PATH` | `sqlite` for local; Postgres/MySQL for prod (see `config/database.ts`). |
| `ODDS_API_KEY` | Enables the live TheOddsAPI provider. Unset → synthetic line mover. |
| `BROADCAST_HOST` / `BROADCAST_PORT` | Realtime (ts-broadcasting) server bind (default `0.0.0.0:6001`). |
| `BROADCAST_SCHEME` | `ws` locally, `wss` in production (behind TLS). |
| `BROADCAST_REDIS_ENABLED` + `REDIS_*` | Required when the API/ingest run in **separate** processes from the broadcast server so broadcasts fan out across them. See `config/realtime.ts`. |
| `SUDO_PASSWORD` | Local-only: lets dev rpx bind :443 for HTTPS. Never set in prod. |
| `TRADING_ENABLED` | Set to `false` and no strategy places an order, whatever the halt log says. The deployment-level stop, deliberately not clearable from inside the app. |

## Build & deploy

```bash
./buddy migrate              # create the schema (incl. odds, snapshots, bet_sheets)
./buddy db:seed --class=OddsSeeder   # seed the demo board (skip once a live feed is wired)
./buddy build                # build app, views, API
./buddy deploy               # provision + deploy to AWS (config/cloud.ts)
```

## Runtime processes

Production runs three roles (see `config/realtime.ts`, `app/Scheduler.ts`):

1. **Web/API** — serves the SSR board + `/api/*` actions.
2. **Realtime server** — the ts-broadcasting WebSocket server on `BROADCAST_PORT`; the SPA connects here for live price updates on the `odds` channel.
3. **Scheduler/queue worker** — runs the ingestion, reconciliation, and
   trading loops (see `app/Scheduler.ts`). The one that must not be missed
   is `SyncOrders`, every minute: until an order has been read back from
   the venue, the position cap, the bankroll check, and the daily loss
   limit are all working from what was true at placement.

With all three in one process the in-memory broadcaster suffices; when they
scale to separate processes/instances, enable the Redis adapter so a
broadcast from the ingest worker reaches clients connected to the realtime
server.

## Stopping trading

```bash
./buddy trading:halt --reason "why" --actor "you"
./buddy trading:status
./buddy trading:resume
```

Takes effect on every process within one pass, no redeploy. Decisions keep
being recorded while it is stopped, so the engine's reasoning stays visible;
only orders are withheld. `TRADING_ENABLED=false` outranks it and cannot be
cleared from inside the app.

## Health

`/api/health` (and `/api/v1/health`) reports this instance and its
dependencies. It answers 503 only when the database is unreachable — stale
ingestion and a missing cache are properties of the whole deployment, and
draining every instance over them turns a stale board into no board. Point
the load balancer at it; the `Watchdog` job is what alerts on staleness.

## Notes

- Odds shown are samples until `ODDS_API_KEY` is set; the provider layer in
  `app/Services/odds/` swaps the source with no UI changes.
- Bet sheets persist by signed-in user or anonymous token (`/api/sheets`).
- Includes responsible-gambling messaging; review jurisdiction/compliance
  (geo, age, licensing) before any real-money launch.
- New strategies default to **paper**: same decisions, same limits,
  simulated fills, no venue contact. Going live is an explicit choice.
- `/api/v1` accepts an API key and meters it against the plan behind the
  account. `/api/v1/training` requires one.
