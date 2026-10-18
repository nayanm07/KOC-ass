# Kingdom of Chess — Live Tournament Module

Coaches run tournaments; students join, get **auto-matched**, and play each other **live** on a shared board with a **server-authoritative clock**; results feed a **leaderboard** in real time.

Two tournament formats: **Arena** (play as many games as you like, paired with the closest-ranked waiting player) and **Round robin** (everyone plays everyone once; the tournament completes itself and declares the winner after the last game).

**Golden path:** join a tournament → *Find opponent* → play the match live → see it on the leaderboard.

| | |
|---|---|
| **Backend** | NestJS 11 (TS strict) · Drizzle ORM + PostgreSQL · Socket.IO · class-validator DTOs |
| **Frontend** | Next.js 15 App Router · React 19 (strict) · Tailwind v4 + shadcn/ui · TanStack Query · socket.io-client |
| **Chess** | `chess.js` (rules, PGN) · `react-chessboard` (UI) |
| **Infra** | Docker Compose (Postgres + API + Web), Drizzle migrations, idempotent seed |

---

## Contents
1. [Quick start (Docker, one command)](#1-quick-start-docker-one-command)
2. [Local development setup](#2-local-development-setup)
3. [Seed credentials](#3-seed-credentials)
4. [How to play a match locally](#4-how-to-play-a-match-locally)
5. [Architecture](#5-architecture)
6. [REST API](#6-rest-api)
7. [Socket.IO events](#7-socketio-events)
8. [Tests](#8-tests)
9. [Decisions & trade-offs](#9-decisions--trade-offs)
10. [What I'd do next](#10-what-id-do-next)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Quick start (Docker, one command)

Requires Docker with Compose v2.

```bash
git clone <this-repo> kingdom-of-chess && cd kingdom-of-chess
cp .env.example .env          # optional — sensible defaults are built in
docker compose up --build
```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| API | http://localhost:4000/api/v1/health |
| Postgres | `localhost:5440` (user `chess` / pass `chess` / db `kingdom_chess`) |

On start the API container **applies migrations and seeds** the database (both idempotent), then starts.
Ports are configurable in `.env` (`WEB_PORT`, `API_PORT`, `DB_HOST_PORT`) if 3000 / 4000 / 5440 are taken.

> Postgres is published on **5440** rather than 5432 so it doesn't collide with a locally installed Postgres.

---

## 2. Local development setup

**Prerequisites:** Node.js 22+, npm 10+, and Postgres 16 (Docker is easiest).

```bash
# 1. Install (npm workspaces — one install for both apps, run from the repo root)
npm install

# 2. Environment
cp .env.example .env
cp apps/api/.env.example apps/api/.env          # set JWT_SECRET to a long random string
cp apps/web/.env.example apps/web/.env.local

# 3. Postgres — any of:
docker compose up -d db                         # Docker (recommended) → localhost:5440
#   …or point DATABASE_URL in apps/api/.env at a local / Neon / Supabase Postgres

# 4. Schema + seed data
npm run db:migrate
npm run db:seed

# 5. Run both apps (two terminals)
npm run dev:api        # http://localhost:4000  (Nest, watch mode)
npm run dev:web        # http://localhost:3000  (Next, Turbopack)
```

### Environment variables

**`apps/api/.env`**

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `DATABASE_URL` | `postgres://chess:chess@localhost:5440/kingdom_chess` | Postgres connection |
| `JWT_SECRET` | — (required, ≥ 16 chars) | Signs the session JWT |
| `JWT_TTL_SECONDS` | `604800` (7 days) | Session length |
| `WEB_ORIGIN` | `http://localhost:3000` | CORS origin for Socket.IO |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `PAIRING_WINDOW_MS` | `1500` | Matchmaking pool window — players queueing within it are paired together by standings (`0` = pair instantly) |

The API **validates its environment at boot** and refuses to start with a clear message if anything is missing or malformed.

**`apps/web/.env.local`**

| Variable | Default | Purpose |
|---|---|---|
| `API_INTERNAL_URL` | `http://localhost:4000` | Where Next proxies `/api/*` (server-side) |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:4000` | Socket.IO endpoint the browser connects to |

### Useful scripts (from the repo root)

| Command | What it does |
|---|---|
| `npm run dev:api` / `npm run dev:web` | Start API / web in watch mode |
| `npm run db:generate` | Generate a new migration from `apps/api/src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed users + sample tournaments (safe to re-run) |
| `npm test` | API unit tests (86) |

---

## 3. Seed credentials

| Role | Email | Password |
|---|---|---|
| ♚ Coach | `coach@koc.test` | `Coach@1234` |
| ♟ Student | `aarav@koc.test` | `Student@1234` |
| ♟ Student | `diya@koc.test` | `Student@1234` |
| ♟ Student | `kabir@koc.test` | `Student@1234` |
| ♟ Student | `meera@koc.test` | `Student@1234` |
| ♟ Student | `rohan@koc.test` | `Student@1234` |
| ♟ Student | `ananya@koc.test` | `Student@1234` |

The login page also has one-click **demo account** buttons. The seed creates **Weekend Blitz Cup** (5+0, open for registration) and **Rapid Academy Open** (10+5, draft).

---

## 4. How to play a match locally

You need **two separate browser sessions** (cookies are per browser): e.g. one normal window + one incognito window, or Chrome + Firefox.

1. **Coach** (any window): log in as `coach@koc.test` → open **Weekend Blitz Cup** → it's already open for registration (or click *Open registration*).
2. **Window A:** log in as `aarav@koc.test` → *Tournaments* → **Join tournament**.
3. **Window B (incognito):** log in as `diya@koc.test` → **Join tournament**.
4. **Coach:** click **Start tournament** (needs ≥ 2 players). Log out of the coach session if you used window A or B.
5. **Both students:** open the tournament → **Find opponent**. The server pairs you and both windows jump straight into the game (no refresh).
6. **Play.** Drag or click pieces. Moves appear on the other board instantly; clocks run on the server. Try *Offer draw* / *Resign*, refresh mid-game (board + clock are restored), or let a clock run out.
7. When the game ends both players get a result dialog → **Find next opponent** to re-queue, or open the tournament to see the **leaderboard** update live.
8. **Coach:** the tournament page shows stats, live standings and a **Watch** button on live games (spectator mode). Click **Complete tournament** to declare the winner.

**Round robin:** create a tournament with format *Round robin* (coach → *New tournament*). Players can only be paired with someone they haven't played; the leaderboard shows progress and a crosstable, and the tournament completes itself after the last game. With 3–4 students in separate browsers you can play it to the end.

---

## 5. Architecture

```
apps/
├─ api/                         NestJS 11
│  ├─ drizzle/                  SQL migrations (generated by drizzle-kit)
│  └─ src/
│     ├─ auth/                  login/logout, GET /me, JWT cookie
│     ├─ common/                response envelope, exception filter, guards, decorators
│     ├─ config/                env validation
│     ├─ db/                    schema, migrate + seed scripts
│     ├─ tournaments/           CRUD, join rules (tournament.rules.ts), standings.ts, leaderboard
│     ├─ matchmaking/           FIFO queue + pairing (pairing.ts)
│     ├─ matches/               game engine (game.service.ts), game.rules.ts, clock.ts, REST
│     └─ realtime/              Socket.IO gateway, auth handshake, event contract (events.ts)
└─ web/                         Next.js 15 App Router
   └─ src/
      ├─ app/                   /login, /coach/*, /student/*, /match/[id]
      ├─ components/            app shell, socket provider, match/, tournaments/, ui/ (shadcn)
      ├─ hooks/                 TanStack Query hooks, useLiveMatch
      └─ lib/                   API client, socket contract, types, date formatting
```

### Data model

| Table | Purpose |
|---|---|
| `users` | Coach / student accounts (case-insensitive unique email, bcrypt hash) |
| `tournaments` | Name, format (`arena` / `round_robin`), time control (`base_seconds` + `increment_seconds`), status, start time, winner |
| `tournament_participants` | Who joined (unique per tournament + user) |
| `matchmaking_queue` | Players waiting for an opponent (`user_id` unique → one queue at a time) |
| `matches` | Live game state: FEN, PGN, ply, both clocks, `turn_started_at`, result, end reason |
| `active_players` | **One row per player in a live game, `user_id` is the PK** → the DB itself forbids double-booking |
| `match_moves` | Append-only move log (SAN, squares, FEN after, think time, clocks); `UNIQUE(match_id, ply)` |

Every table has `created_at` / `updated_at` (`timestamptz`); check constraints enforce invariants (e.g. *completed ⇔ has result + reason + ended_at*, white ≠ black, clocks ≥ 0).

### Request flow

```
Browser ──REST /api/v1/*──► Next (rewrite proxy) ──► NestJS ──► Postgres
   │                                                   ▲
   └────────── Socket.IO (cookie-authenticated) ───────┘
```

---

## 6. REST API

Base path **`/api/v1`** (URI versioning). Every response uses one envelope:

```jsonc
// success
{ "success": true, "data": { ... } }
// error
{ "success": false,
  "error": { "statusCode": 409, "code": "TOURNAMENT_NOT_OPEN", "message": "Registration for this tournament has closed", "details": … },
  "path": "/api/v1/tournaments/…/join", "timestamp": "2026-10-18T10:00:00.000Z" }
```

Inputs are validated with **class-validator DTOs** (`whitelist` + `forbidNonWhitelisted` — unknown fields are rejected). Status codes: `400` validation, `401` not logged in, `403` wrong role / not your match, `404`, `409` business-rule conflicts (with a machine-readable `code`).

| Method | Path | Who | Description |
|---|---|---|---|
| `POST` | `/auth/login` | public | Sets the httpOnly JWT cookie |
| `POST` | `/auth/logout` | public | Clears the cookie |
| `GET` | `/me` | any | Current user |
| `GET` | `/health` | public | Liveness |
| `GET` | `/tournaments?status=open,ongoing&joined=true` | any | List (students never see drafts) |
| `GET` | `/tournaments/:id` | any | Detail + participants |
| `GET` | `/tournaments/:id/leaderboard` | any | Standings, winner / current leader, stats, round-robin progress |
| `GET` | `/tournaments/:id/matches` | any | Per-match results (live first) |
| `POST` | `/tournaments` | coach | Create (`name, description?, format?, baseMinutes, incrementSeconds, startsAt, status?`) |
| `PATCH` | `/tournaments/:id` | coach | Edit (format / time control / start locked once started) |
| `PATCH` | `/tournaments/:id/status` | coach | `draft ⇄ open → ongoing → completed` |
| `DELETE` | `/tournaments/:id` | coach | Only draft / open (played games are history) |
| `POST` | `/tournaments/:id/join` | student | Join while `open` |
| `DELETE` | `/tournaments/:id/join` | student | Leave while `open` |
| `GET` | `/matches` | any | My match history |
| `GET` | `/matches/current` | any | My in-progress match id (resume after refresh) |
| `GET` | `/matches/:id` | players + coaches | Full game state incl. live clock |

---

## 7. Socket.IO events

The socket connects to the API origin with `withCredentials`; the **handshake is authenticated with the same httpOnly JWT cookie** (unauthenticated / forged → `connect_error: UNAUTHENTICATED`). Each user joins a private room `user:<id>`; each game has a room `match:<id>` that **only its two players (and coaches, read-only) may join**.

Client → server events are acknowledged with the REST envelope: `{ success: true, data }` or `{ success: false, error: { code, message, details? } }`. Payloads are validated with class-validator DTOs.

| Event | Direction | Payload | Ack / notes |
|---|---|---|---|
| `queue:join` | C → S | `{ tournamentId }` | `{ waiting: true, tournamentId, since }`. Students only; must be a participant of an `ongoing` tournament; `ALREADY_IN_MATCH` (+ `details.matchId`) if already playing; `ROUND_ROBIN_DONE` once you've met everyone |
| `queue:leave` | C → S | `{}` | `{ waiting: false, … }` |
| `queue:status` | S → C | `{ waiting: true, tournamentId, since }` \| `{ waiting: false, tournamentId, reason? }` | On connect and on every change (`matched`, `left`, `tournament_closed`, `disconnected`) |
| `match:found` | S → C | `{ matchId, tournamentId, color, opponent: { id, name } }` | Pushed to both players → client navigates to `/match/:id` |
| `match:join` | C → S | `{ matchId }` | Full `MatchView` (initial state / reconnect). Players + coaches only |
| `match:leave` | C → S | `{ matchId }` | `{ left: true }` |
| `match:move` | C → S | `{ matchId, from, to, promotion?, ply? }` | `{ ply }`. Errors: `NOT_YOUR_TURN`, `ILLEGAL_MOVE`, `STALE_STATE`, `GAME_OVER`, `NOT_A_PARTICIPANT` |
| `match:resign` | C → S | `{ matchId }` | `{ resigned: true }` |
| `match:offer-draw` | C → S | `{ matchId }` | `{ drawOffer, ended }` — accepts if the opponent already offered |
| `match:respond-draw` | C → S | `{ matchId, accept }` | `{ drawOffer, ended }` |
| `match:state` | S → C (room) | `MatchView`: `{ id, fen, pgn, ply, turn, lastMove, drawOffer, status, result, endReason, clock: { whiteMs, blackMs, running, serverNow }, … }` | After every move / draw offer / end |
| `match:ended` | S → C (room + both players) | `{ matchId, tournamentId, result, reason, pgn }` | Result is already persisted |
| `tournament:updated` | S → all | `{ tournamentId }` | Invalidation ping → clients refetch leaderboards / lists |

The contract lives in [`apps/api/src/realtime/events.ts`](apps/api/src/realtime/events.ts) and is mirrored in [`apps/web/src/lib/socket-events.ts`](apps/web/src/lib/socket-events.ts).

---

## 8. Tests

```bash
npm test            # from the repo root — 86 API unit tests
```

The deterministic logic is pure functions with no DB or Nest, so it's tested directly:

| Spec | Covers |
|---|---|
| `tournaments/standings.spec.ts` (13) | **Result → leaderboard scoring**: win 1 / draw ½ / loss 0, white- and black-side wins, Sonneborn-Berger, wins, head-to-head, shared ranks, winner declaration |
| `tournaments/tournament.rules.spec.ts` (42) | **Join rules** (role, already joined, status), leave, queue eligibility (incl. round robin done), every status transition, edit locks, delete protection, round-robin game count + completion |
| `matches/game.rules.spec.ts` (18) | **Move / turn validation**: wrong turn, illegal move, opponent's piece, moves after game over, promotion; checkmate, stalemate, insufficient material, threefold (rebuilt from PGN), resignation, timeout vs. lone king, final PGN; server clock maths (increment, flag) |
| `matchmaking/pairing.spec.ts` (13) | Standings-based pairing (closest points beats queue order, gap ties by waiting time), new opponent preferred over a rematch, round robin never repeats and a blocked anchor doesn't block others, FIFO fallback, colours |

Real-time wiring isn't unit-tested (per the brief), but it was verified end-to-end during development with scripted Socket.IO clients and a headless-Chrome two-player test: 6 students queueing at the same instant → exactly 3 games, nobody double-booked; duplicate move → applied once; move sync ≈ 30 ms; server flag-fall; reconnect restores board + clock.

---

## 9. Decisions & trade-offs

### The live match (headline)
- **Server-authoritative.** Clients only *propose* moves. For every move the server takes a row lock on the match (`SELECT … FOR UPDATE`), checks participant → turn → `ply` (stale board) → clock → legality (chess.js), then writes the move log + new FEN/PGN/clocks in **one transaction** and broadcasts `match:state`. A tampered client can't move out of turn, play an illegal move, or stop its clock.
- **Clock model.** The DB stores each side's remaining time *at the start of the turn* plus `turn_started_at`; live time = stored − (now − turn_started_at). Increment is added after each move. A move that arrives after the flag fell loses on time. A **server-side timer per game** ends it on time even if nobody moves; timers are re-armed from the DB on restart. Clients just render server snapshots and tick locally between them (no client decides flag-fall).
- **White's clock starts at pairing.** Simple, and it doubles as abandonment handling (a no-show loses on time). Trade-off: page-load time (~1 s) is charged to white. A "first move doesn't run the clock" rule would be friendlier.
- **Timeout vs. insufficient material** is a draw (FIDE 6.9) — e.g. flagging against a lone king.
- **Optimistic UI.** Your own move is shown instantly (validated locally with chess.js), then confirmed or rolled back by the ack; every broadcast replaces local state, so two clients can't drift apart.
- **Reconnection.** Everything needed to resume lives in Postgres; the client re-emits `match:join` on every (re)connect and gets the full state back.
- **PGN** is rebuilt from the stored PGN on each move (keeps full history, which threefold repetition needs). For ~100-move games this is negligible; a per-match in-memory cache would avoid it at scale.

### Matchmaking — "never double-booked"
- **Durable queue in Postgres** (`matchmaking_queue`, `user_id` unique) rather than in memory — survives the request lifecycle and is easy to reason about.
- **Pairing is serialised per tournament** with `pg_advisory_xact_lock(hash(tournamentId))`. Without it, two players clicking at the same instant could each see only themselves in the queue and both keep waiting. With row-level `SKIP LOCKED` alone that race exists; the advisory lock removes it.
- **`active_players` (PK = `user_id`)** is inserted in the same transaction that creates the match and deleted in the same transaction that ends it — the database rejects any second concurrent game for a player, regardless of application bugs.
- **Standings-based pairing** (pure `pickPair`): the **longest-waiting player is always paired first** (nobody starves), and their opponent is the waiting player they **haven't played yet**, then **closest in points**, then longest waiting. Colours are random. With no standings it degrades to FIFO.
- **Pairing window** (`PAIRING_WINDOW_MS`, default 1.5 s). If pairing ran on every join, the 2nd player to arrive would always be paired instantly and standings could never matter. The first *Find opponent* in a tournament starts a short timer; everyone who queues before it fires forms one pool. Trade-off: up to 1.5 s extra wait for much better pairings (the same idea as arena "waves" on chess sites).
- **Round robin**: a pair may meet only once; if the longest waiter has already played everyone currently waiting, the next waiter anchors instead, so one player never blocks the queue. You get `ROUND_ROBIN_DONE` once you've met everyone, and the **last game's result completes the tournament** (winner declared, in the same transaction pattern as the coach's button). Participants are fixed once the tournament starts, so the n(n−1)/2 target can't move. Being mid-game is checked first so `ALREADY_IN_MATCH` (which sends you back to your board) always wins.
- Queue rows are removed when a player's **last** tab disconnects, when a tournament completes (players are notified), and on server start.

### Tournaments & leaderboard
- **Students self-join** while a tournament is `open`; they can *Find opponent* once the coach **starts** it (`ongoing`). Lifecycle: `draft ⇄ open → ongoing → completed`; back to draft only with no players; start needs ≥ 2 players; complete is blocked while games are live; time control + start time lock once started; started tournaments can't be deleted (keeps history). Any coach can manage any tournament (one academy).
- **Standings are computed from completed matches** (single source of truth — no stored points that can drift), in **half-point integers** so ½ never becomes a float problem.
- **Tiebreak: points → Sonneborn-Berger → wins → head-to-head (exactly two tied).** SB rewards results against strong opponents and is standard for Swiss-style events; players still level share the rank ("1, 2, 2, 4").
- **Winner** is computed from the final standings in the same transaction that marks the tournament completed. If first place is still shared, no single winner is declared and the UI says so instead of picking arbitrarily.
- **Live leaderboards without polling:** a tiny `tournament:updated { tournamentId }` ping is broadcast on join/leave/status/pairing/game end; clients invalidate their TanStack Query caches. It carries no private data.

### Auth & API
- **JWT in an httpOnly, SameSite=Lax cookie** — not readable by JS. **Next rewrites `/api/*` to the API**, so the cookie is first-party and REST needs no CORS; only the WebSocket connects to the API origin directly (cookies aren't port-scoped on `localhost`). In production behind different domains I'd also route the socket through the same origin (reverse proxy) and set `COOKIE_SECURE=true`.
- **Role checks on both ends:** global `JwtAuthGuard` (opt out with `@Public()`) + `RolesGuard` (`@Roles('coach')`) on the API; Next middleware redirects by role early, and the app shell re-checks against the verified `/me`. The middleware only *decodes* the JWT for routing — the API verifies it on every request.
- Login is timing-safe (a dummy bcrypt compare for unknown emails), emails are case-insensitive, Postgres constraint errors are mapped to `409/400` instead of `500`.

### Frontend
- TanStack Query for all REST with hierarchical keys and invalidation after every mutation; one Socket.IO connection per tab via a provider; shared **loading / error (with retry) / empty** components on every screen, plus a route error boundary and 404.
- Dates are stored as UTC (`timestamptz`) and shown as **DD/MM/YYYY** in the viewer's timezone; the create form labels the timezone.
- Board supports drag-and-drop **and click-to-move** (easier for young players), legal-move dots, last-move and check highlights, promotion picker, move-list review, copy PGN.

### Caveats (single-instance assumptions)
- Flag timers, pairing-window timers and draw offers live in the API process; queue cleanup on boot assumes one API instance. Scaling out would need the Socket.IO Redis adapter, a shared timer/scheduler (or "check on read" only) and Redis for draw offers.
- No refresh-token rotation or rate limiting on login (would add `@nestjs/throttler`).
- Lists aren't paginated (fine for an academy's tournament count).

---

## 10. What I'd do next
1. Clock starts on white's first move; abort a game if white never moves (no rating/score impact).
2. Proper Swiss rounds (round-by-round pairing with colour balancing) as a third format.
3. Horizontal scaling: Redis adapter for Socket.IO, distributed flag timers, Redis-backed draw offers.
4. Opponent presence ("disconnected — 30 s to return") and premoves.
5. E2E tests in CI (Playwright two-browser flow) and API integration tests against a throwaway Postgres.
6. Rate limiting + refresh tokens; audit log of coach actions.

---

## 11. Troubleshooting
- **Port already in use** — change `WEB_PORT` / `API_PORT` / `DB_HOST_PORT` in `.env` (Docker) or `PORT` in `apps/api/.env`.
- **`password authentication failed` on 5432** — a local Postgres is answering; this project's Docker Postgres is on **5440**.
- **Windows: `npm install` hangs or fails with locked files** — stop `npm run dev:api` / `dev:web` first (dev servers lock files in `node_modules`).
- **Next dev shows a 500 after adding routes / layout changes don't appear** — stop the dev server, delete `apps/web/.next`, start again.
- **Socket shows "Offline"** — the API must be reachable at `NEXT_PUBLIC_SOCKET_URL` and `WEB_ORIGIN` must match the web origin exactly.
