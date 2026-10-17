# Kingdom of Chess — Tournament Module · Roadmap & Checklist

> Budget: 48h max. Priority order is from the brief: **live match loop first**, then the tournament admin around it.
> Golden path to always keep working: **join a tournament → play a match → see it on the leaderboard**.

---

## Architecture at a glance

```
apps/
  api/   NestJS 11 · Drizzle + Postgres · Socket.IO · class-validator   (port 4000)
  web/   Next.js App Router · React 19 · Tailwind + shadcn/ui · TanStack Query · socket.io-client  (port 3000)
docker-compose.yml  → postgres + api + web
```

**Key decisions (to be explained in README → Decisions & trade-offs):**

| Area | Decision |
|---|---|
| Repo | npm-workspaces monorepo (`apps/api`, `apps/web`) |
| Auth | Email + bcrypt password → JWT in `httpOnly` cookie (`access_token`). `JwtAuthGuard` + `RolesGuard` (`@Roles('coach')`). Socket handshake reads the same cookie. |
| API | URI versioning `/api/v1/...`. Envelope: `{ success, data }` / `{ success:false, error:{ code, message, details } }` via global interceptor + exception filter. `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`. |
| Game state | **Server-authoritative**: server holds a `chess.js` instance per live match, validates every move + turn, owns the clock. Client only *proposes* moves. |
| Clock | Server stores `whiteMs`, `blackMs`, `turnStartedAt`. Remaining time = stored − (now − turnStartedAt). A server-side timeout per match fires flag-fall. Clients render from server snapshots and tick locally between them. |
| Persistence | `fen` + `pgn` + clocks written to `matches` on every move → refresh/reconnect restores board & clock. |
| Matchmaking | Per-tournament FIFO queue. Pairing done in a DB transaction with a conditional update (`current_match_id IS NULL`) so a player can **never be double-booked**, even with two tabs / races. |
| Scoring | Win 1 · Draw ½ · Loss 0 (stored as half-points integers to avoid float issues). |
| Tiebreak | Points → Sonneborn-Berger → number of wins → head-to-head → name. |
| Join rule | Students self-join tournaments with status `open`. Queueing allowed when `open`/`ongoing` and participant. |

---

## Phase 0 — Setup (≈2h)
- [x] git init, `.gitignore`, monorepo with npm workspaces
- [x] Scaffold NestJS 11 API (TS strict)
- [x] Scaffold Next.js App Router web (React 19, TS strict, Tailwind)
- [x] shadcn/ui init + base components (button, card, input, label, table, badge, dialog, select, sonner/toast, skeleton)
- [x] Install deps (drizzle, pg, socket.io, chess.js, react-chessboard, TanStack Query, …)
- [x] `docker-compose.yml` (postgres + api + web) + Dockerfiles — not yet run locally (no Docker installed)
- [x] `.env.example` for root / api / web
- [ ] Postgres reachable (Docker **or** Neon/Supabase URL)

## Phase 1 — Data model & auth (≈5h) · Req 01
- [ ] Drizzle schema: `users`, `tournaments`, `tournament_participants`, `matches`
- [ ] Drizzle migrations generated + `db:migrate` script
- [ ] Seed: 1 coach + 4+ students (+ one sample tournament)
- [ ] `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/me`
- [ ] JWT httpOnly cookie, `JwtAuthGuard`, `RolesGuard`, `@CurrentUser()`
- [ ] Response envelope interceptor + global exception filter + ValidationPipe
- [ ] Web: login page, auth context via `/me`, `middleware.ts` route protection, role-based redirects

## Phase 2 — Tournaments (≈4h) · Req 02, 03 (join)
- [ ] Coach: CRUD tournament (name, time control `5+0`, startsAt, status draft/open/ongoing/completed)
- [ ] Student: list open/ongoing tournaments, join open one (join rules)
- [ ] Coach UI: list, create/edit dialog, status change, delete
- [ ] Student UI: browse + join, "my tournaments / schedule"

## Phase 3 — Matchmaking (≈4h) · Req 03 ⚠️ concurrency test
- [ ] Socket gateway with cookie-auth handshake
- [ ] `queue:join` / `queue:leave` per tournament
- [ ] Pair two waiting players atomically → create match → push `match:found` to both
- [ ] One active match per player guaranteed (DB-level check + in-memory lock)
- [ ] Re-queue after game ends

## Phase 4 — Live match (≈8h) · Req 04 ★ HEADLINE
- [ ] `match:join` (room auth: only the 2 participants)
- [ ] `match:move` → server validates turn + legality (chess.js) → broadcast `match:state`
- [ ] Shared server clock, flag-fall on timeout
- [ ] Resign, checkmate, stalemate / insufficient material / threefold / 50-move draws
- [ ] PGN shown live, persisted on end
- [ ] Result saved → leaderboard updated → `match:ended` broadcast
- [ ] Web: board (react-chessboard), orientation by colour, clocks, PGN panel, resign button, end-of-game dialog with "Find next opponent"

## Phase 5 — Leaderboard & stats (≈3h) · Req 05, 02 (stats)
- [ ] Pure `computeStandings(participants, matches)` with tiebreaks
- [ ] `GET /tournaments/:id/leaderboard`, `GET /tournaments/:id/matches`
- [ ] Winner declared when tournament status = completed
- [ ] Web: leaderboard table, per-match results, my rank, my match history

## Phase 6 — Quality (≈4h) · Req 06, 07, 08
- [ ] Unit tests: scoring/standings, join rules, move/turn validation, matchmaking pairing
- [ ] Loading / error / empty states on every page
- [ ] TanStack Query invalidation after every mutation + on socket `match:ended`
- [ ] DD/MM/YYYY dates, IST-aware display

## Phase 7 — README & submission (≈2h) · Req 09
- [ ] Setup (env, Postgres, migrations, seed, start both apps), seed credentials
- [ ] How to play locally (two browsers / one incognito)
- [ ] Socket event table (name → payload → direction)
- [ ] Decisions & trade-offs, what I'd do next
- [ ] Clean-machine test: clone → follow README → works
- [ ] Push to GitHub

---

## Stretch (only after the core works)
- [x] *(designed in)* Server-authoritative state
- [x] *(designed in)* Reconnection — board + clock restored from DB on refresh
- [ ] Spectator mode for coach
- [ ] Draw offers + increment time controls (`5+3`)
- [ ] Standings-based matchmaking
- [ ] Round-robin completion (everyone plays everyone once, auto-complete)
- [ ] Move-list navigation (click a move to review)

## Socket events (draft — finalise in README)

| Event | Direction | Payload |
|---|---|---|
| `queue:join` | C → S | `{ tournamentId }` |
| `queue:leave` | C → S | `{ tournamentId }` |
| `queue:status` | S → C | `{ tournamentId, waiting: boolean }` |
| `match:found` | S → C | `{ matchId, tournamentId, color }` |
| `match:join` | C → S | `{ matchId }` |
| `match:state` | S → C | `{ matchId, fen, pgn, turn, whiteMs, blackMs, serverNow, status, lastMove }` |
| `match:move` | C → S | `{ matchId, from, to, promotion? }` |
| `match:resign` | C → S | `{ matchId }` |
| `match:ended` | S → C | `{ matchId, result, reason, pgn }` |
| `error` | S → C | `{ code, message }` |

## Commit plan (small, meaningful)
`chore: scaffold monorepo` → `feat(api): db schema + migrations` → `feat(api): auth` → `feat(web): login` → `feat(api): tournaments` → … → `docs: README`
