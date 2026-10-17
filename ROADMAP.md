# Kingdom of Chess — Tournament Module · Roadmap & Checklist

> Budget: 48h max (started 17/10/2026). Priority order is from the brief: **live match loop first**, then the tournament admin around it.
> Golden path to always keep working: **join a tournament → play a match → see it on the leaderboard**.

## Progress

| Phase | Status |
|---|---|
| 0 · Setup | ✅ Done |
| 1 · Data model & auth | ✅ Done |
| 2 · Tournaments | ✅ Done |
| 3 · Matchmaking | ⏳ Next (DB tables ready) |
| 4 · Live match ★ | ⬜ Not started (DB tables ready) |
| 5 · Leaderboard & stats | ⬜ Not started |
| 6 · Quality | 🟡 Partly (shared loading/error/empty components exist) |
| 7 · README & submission | ⬜ Not started |

---

## Architecture at a glance

```
apps/
  api/   NestJS 11 · Drizzle + Postgres · Socket.IO · class-validator   (port 4000)
  web/   Next.js 15 App Router · React 19 · Tailwind + shadcn/ui · TanStack Query · socket.io-client  (port 3000)
docker-compose.yml  → postgres (host port 5440) + api + web
```

**Key decisions (to be explained in README → Decisions & trade-offs):**

| Area | Decision |
|---|---|
| Repo | npm-workspaces monorepo (`apps/api`, `apps/web`) — one install, one lockfile, same `chess.js` version on client and server |
| Auth | Email + bcrypt password → JWT in `httpOnly` cookie (`access_token`). Global `JwtAuthGuard` (opt out with `@Public()`) + global `RolesGuard` (`@Roles('coach')`). Socket handshake will read the same cookie. |
| Cookie / CORS | Web proxies `/api/*` to the API via a Next rewrite → cookie is first-party, no CORS for REST. CORS (with credentials) only needed for Socket.IO. |
| API | URI versioning `/api/v1/...`. Envelope: `{ success, data }` / `{ success:false, error:{ statusCode, code, message, details }, path, timestamp }` via global interceptor + exception filter. `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`. Postgres errors mapped (unique → 409, check → 400). |
| Config | Env validated with class-validator at boot — the API refuses to start on missing/invalid env. |
| Game state | **Server-authoritative**: server holds a `chess.js` instance per live match, validates every move + turn, owns the clock. Client only *proposes* moves. |
| Clock | `matches.white_time_ms`, `black_time_ms`, `turn_started_at`. Remaining = stored − (now − turnStartedAt). Server-side timeout per match fires flag-fall. Time control is **snapshotted** on the match so editing the tournament can't change a live game. |
| Persistence | `fen` + `pgn` + `ply` + clocks written to `matches` on every move → refresh/reconnect restores board & clock. Every move also appended to `match_moves`. |
| Matchmaking | Durable `matchmaking_queue` table (one row per waiting player, `user_id` unique). Pairing with `SELECT … FOR UPDATE SKIP LOCKED` (FIFO by `enqueued_at`). |
| No double-booking | `active_players` table with `user_id` as **primary key** — inserted in the same transaction that creates the match. A second concurrent pairing for the same player hits a unique violation and rolls back. Rows deleted when the match ends. |
| Move races | `UNIQUE(match_id, ply)` on `match_moves` + `ply` as optimistic version → two racing writes for the same move can't both land. |
| Scoring | Win 1 · Draw ½ · Loss 0, computed from completed matches (single source of truth, no stored points to drift). |
| Tiebreak | Points → Sonneborn-Berger → number of wins → head-to-head → name. |
| Join rule | Students self-join while status is `open` (registration). Leave only while `open`. "Find opponent" only when `ongoing` and a participant. Any coach can manage any tournament (single academy). |

---

## Phase 0 — Setup ✅
- [x] git init, `.gitignore`, `.gitattributes` (LF line endings), monorepo with npm workspaces
- [x] Scaffold NestJS 11 API — TS `strict: true`
- [x] Scaffold Next.js 15 App Router web (React 19, TS strict, Tailwind v4)
- [x] shadcn/ui init + base components (button, card, input, label, table, badge, dialog, select, sonner, skeleton, dropdown-menu, tabs, alert, separator, avatar)
- [x] Install deps (drizzle, pg, socket.io, chess.js, react-chessboard, TanStack Query, bcryptjs, …) — Nest packages pinned to v11 (Nest 12 is out; brief requires 11)
- [x] `docker-compose.yml` (postgres + api + web) + Dockerfiles (api: migrate → seed → start; web: Next standalone)
- [x] `.env.example` for root / api / web (real `.env` files git-ignored)
- [x] Postgres running — Docker in WSL, host port **5440** (5432/5433 taken by local Postgres 16/18 installs)
- [ ] Full `docker compose up --build` (api + web images) verified — do before submission

## Phase 1 — Data model & auth ✅ · Req 01
**Database**
- [x] Drizzle schema — 7 tables: `users`, `tournaments`, `tournament_participants`, `matchmaking_queue`, `matches`, `active_players`, `match_moves`
- [x] `created_at` / `updated_at` (timestamptz) on every table, `updated_at` auto-bumped; plus domain timestamps (`last_login_at`, `joined_at`, `enqueued_at`, `started_at`, `ended_at`, `completed_at`, `turn_started_at`)
- [x] Enums: role, tournament status, match status / result / end reason, piece colour
- [x] Constraints: case-insensitive unique email, time-control ranges, white ≠ black, clocks ≥ 0, "completed ⇔ has result + reason + ended_at", "completed ⇔ completed_at"
- [x] Indexes on every FK / lookup path
- [x] Migration `0000_init.sql` generated + applied (`npm run db:migrate`)
- [x] Seed — idempotent (safe to re-run): 1 coach + 6 students + 2 tournaments (`Weekend Blitz Cup` open 5+0, `Rapid Academy Open` draft 10+5)

**API**
- [x] `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/me`, `GET /api/v1/health`
- [x] JWT httpOnly cookie (SameSite=Lax, 7-day TTL), bcrypt, timing-safe login (dummy hash for unknown emails)
- [x] Global `JwtAuthGuard` + `RolesGuard`, `@Public()`, `@Roles()`, `@CurrentUser()`
- [x] Response envelope interceptor + global exception filter + ValidationPipe
- [x] Env validation at boot
- [x] Tested: health, 401 without cookie, 401 wrong password, 400 validation (incl. unknown fields), mixed-case email login, `/me`, forged token 401, logout clears cookie, 404 envelope

**Web**
- [x] Brand theme (navy / orange / cream from the brief)
- [x] API client unwrapping the envelope into typed data / `ApiError`
- [x] TanStack Query provider (no retries on 4xx), `useMe` / `useLogin` / `useLogout` (clears cache on logout)
- [x] Login page with inline errors, loading state, demo-account quick-fill
- [x] `middleware.ts` redirects: logged-out → `/login?next=…`; wrong role → own home
- [x] `AppShell` re-checks role against verified `/me` (frontend half of role enforcement), header nav + logout
- [x] Shared `LoadingState` / `ListSkeleton` / `ErrorState` (with retry) / `EmptyState`
- [x] Tested: all redirects for logged-out, student, coach through the Next proxy

## Phase 2 — Tournaments ✅ · Req 02, 03 (join)
**API** (`/api/v1/tournaments`)
- [x] `GET /` (filters `?status=open,ongoing&joined=true`), `GET /:id` (with participants)
- [x] Coach: `POST /`, `PATCH /:id`, `PATCH /:id/status`, `DELETE /:id`
- [x] Student: `POST /:id/join`, `DELETE /:id/join` (leave)
- [x] Pure rules in `tournament.rules.ts` — 37 unit tests (join, leave, queue, transitions, edit, delete)
- [x] Lifecycle: draft ⇄ open → ongoing → completed. open→draft only with 0 players; start needs ≥ 2 players; complete blocked while games are live
- [x] Time control + start time locked once ongoing; delete only draft/open (keeps match history)
- [x] Students never see drafts (404); students get 403 on coach routes (verified)
- [x] Concurrency: row locks (`FOR UPDATE` / `FOR SHARE`) serialise joins vs status changes; 10 parallel joins → exactly 1 succeeds (verified)
- [x] Tested end-to-end with curl: every rule, validation errors, bad UUID, bad filter

**Web**
- [x] Coach: list with status filter tabs + counts, create/edit dialog (time-control presets, timezone-labelled start), status buttons driven by `allowedTransitions`, confirm dialogs, delete
- [x] Coach: tournament detail with players table (standings placeholder until Phase 5)
- [x] Student: Browse (Live / Open / Finished) + My schedule (upcoming & past), Join / Leave with confirm
- [x] Student: tournament detail with "play panel" (Find opponent button wired in Phase 3)
- [x] TanStack Query keys + invalidation after every mutation, toasts on success/error
- [x] DD/MM/YYYY dates in viewer's timezone (stored UTC)
- [x] Production build passes

## Phase 3 — Matchmaking · Req 03 ⚠️ concurrency test
- [x] *(schema)* `matchmaking_queue` + `active_players` tables for DB-enforced no-double-booking
- [ ] Socket gateway with cookie-auth handshake
- [ ] `queue:join` / `queue:leave` per tournament
- [ ] Pair two waiting players atomically → create match → push `match:found` to both
- [ ] Clean up queue rows on disconnect / server start
- [ ] Re-queue after game ends

## Phase 4 — Live match ★ HEADLINE · Req 04
- [x] *(schema)* `matches` holds fen / pgn / ply / clocks; `match_moves` log
- [ ] `match:join` (room auth: only the 2 participants)
- [ ] `match:move` → server validates turn + legality (chess.js) → broadcast `match:state`
- [ ] Shared server clock, flag-fall on timeout
- [ ] Resign, checkmate, stalemate / insufficient material / threefold / 50-move draws
- [ ] PGN shown live, persisted on end
- [ ] Result saved → leaderboard updated → `match:ended` broadcast
- [ ] Web: board (react-chessboard), orientation by colour, clocks, PGN panel, resign button, end-of-game dialog with "Find next opponent"

## Phase 5 — Leaderboard & stats · Req 05, 02 (stats)
- [ ] Pure `computeStandings(participants, matches)` with tiebreaks
- [ ] `GET /tournaments/:id/leaderboard`, `GET /tournaments/:id/matches`
- [ ] Winner declared when tournament status = completed
- [ ] Web: leaderboard table, per-match results, my rank, my match history

## Phase 6 — Quality · Req 06, 07, 08
- [ ] Unit tests: scoring/standings, join rules, move/turn validation, matchmaking pairing
- [x] Shared loading / error / empty state components
- [ ] …used on every page
- [ ] TanStack Query invalidation after every mutation + on socket `match:ended`
- [ ] DD/MM/YYYY dates, IST-aware display

## Phase 7 — README & submission · Req 09
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
- [ ] Draw offers + increment time controls (`5+3`) — increment already stored per match
- [ ] Standings-based matchmaking
- [ ] Round-robin completion (everyone plays everyone once, auto-complete)
- [ ] Move-list navigation (click a move to review) — `match_moves.fen_after` already stored

## Seed credentials

| Role | Email | Password |
|---|---|---|
| Coach | `coach@koc.test` | `Coach@1234` |
| Student | `aarav@koc.test`, `diya@koc.test`, `kabir@koc.test`, `meera@koc.test`, `rohan@koc.test`, `ananya@koc.test` | `Student@1234` |

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

## Issues hit & how they were solved (useful for README)
- **Nest 12 released** → `@nestjs/websockets@latest` required Nest 12; pinned all Nest packages to `^11` to match the brief.
- **Port 5432 already used** by locally installed Postgres 16/18 → Docker Postgres exposed on host port 5440 (`DB_HOST_PORT`).
- **`drizzle-kit` couldn't find `drizzle-orm`** (nested in `apps/api/node_modules` after incremental installs) → clean reinstall hoisted it to the root.
- **`npm install` hung** because `npm run dev:api` was locking files in `node_modules` → always stop dev servers before installing on Windows.
- **Next dev 500 on `[id]` pages** ("Jest worker encountered 2 child process exceptions") after adding dynamic routes while the dev server ran → corrupted `.next` cache; deleting `apps/web/.next` fixed it (code verified with a clean server + production build).

## Commits so far
`docs: roadmap` → `chore(api): scaffold` → `chore(web): scaffold` → `chore: docker compose` → `chore: LF + web env` → `chore: postgres port 5440` → `feat(api): schema + migration + seed` → `feat(api): envelope + filter + env validation` → `feat(api): auth + guards` → `chore: lockfile` → `feat(web): api client + query + auth hooks` → `feat(web): login + middleware + shell`
