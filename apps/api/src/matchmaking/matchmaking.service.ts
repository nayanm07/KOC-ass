import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, notExists, sql } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { DRIZZLE, type Database } from '../db/db.module';
import {
  activePlayers,
  matches,
  matchmakingQueue,
  tournamentParticipants,
  tournaments,
  users,
} from '../db/schema';
import { ServerEvents, type MatchFoundPayload, type QueueStatusPayload } from '../realtime/events';
import { RealtimeService } from '../realtime/realtime.service';
import { GameService } from '../matches/game.service';
import { checkCanQueue } from '../tournaments/tournament.rules';
import { TournamentsService } from '../tournaments/tournaments.service';
import { assignColors, pairKey, pickPair, type PairingContext } from './pairing';

type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

interface CreatedMatch {
  matchId: string;
  tournamentId: string;
  whiteId: string;
  blackId: string;
}

@Injectable()
export class MatchmakingService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MatchmakingService.name);
  /** One pending pairing run per tournament (see schedulePairing) */
  private readonly pairingTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tournamentsService: TournamentsService,
    private readonly realtime: RealtimeService,
    private readonly game: GameService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Queue rows belong to live socket connections. After a restart no socket is connected,
   * so any leftover rows are stale. (Single-instance assumption — see README trade-offs.)
   */
  onApplicationShutdown() {
    for (const t of this.pairingTimers.values()) clearTimeout(t);
    this.pairingTimers.clear();
  }

  async onApplicationBootstrap() {
    const removed = await this.db.delete(matchmakingQueue).returning({ id: matchmakingQueue.id });
    if (removed.length) this.logger.log(`Cleared ${removed.length} stale queue entries`);
  }

  /** "Find opponent": validate, enqueue, then try to pair immediately */
  async joinQueue(user: AuthUser, tournamentId: string): Promise<QueueStatusPayload> {
    const since = await this.db.transaction(async (tx) => {
      const [t] = await tx
        .select({ status: tournaments.status, format: tournaments.format })
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
        .for('share');
      if (!t || t.status === 'draft') {
        throw new NotFoundException({ code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found' });
      }

      // At most one match at a time: send them back to the game they're already in.
      // Checked first — "you're mid-game" is the most useful answer (the client navigates there).
      const [active] = await tx
        .select({ matchId: activePlayers.matchId })
        .from(activePlayers)
        .where(eq(activePlayers.userId, user.id));
      if (active) {
        throw new ConflictException({
          code: 'ALREADY_IN_MATCH',
          message: 'You are already playing a game',
          details: { matchId: active.matchId },
        });
      }

      const joined = await this.tournamentsService.isParticipant(tx, tournamentId, user.id);
      // Round robin: you can only queue while there's someone you haven't played yet
      const opponentsLeft =
        t.format === 'round_robin' && joined
          ? await this.opponentsLeft(tx, tournamentId, user.id)
          : undefined;
      const v = checkCanQueue({ status: t.status, joined, opponentsLeft });
      if (v) throw new ConflictException(v);

      // user_id is unique: re-queueing in the same tournament keeps your place;
      // queueing in another tournament moves you there.
      const [row] = await tx
        .insert(matchmakingQueue)
        .values({ tournamentId, userId: user.id })
        .onConflictDoUpdate({
          target: matchmakingQueue.userId,
          set: {
            tournamentId,
            enqueuedAt: sql`case when ${matchmakingQueue.tournamentId} = excluded.tournament_id then ${matchmakingQueue.enqueuedAt} else now() end`,
          },
        })
        .returning({ enqueuedAt: matchmakingQueue.enqueuedAt });
      return row.enqueuedAt;
    });

    const status: QueueStatusPayload = { waiting: true, tournamentId, since: since.toISOString() };
    this.realtime.toUser(user.id, ServerEvents.QueueStatus, status);

    await this.schedulePairing(tournamentId);
    return status;
  }

  /**
   * Pairing window: the first "Find opponent" in a tournament starts a short timer; everyone who
   * queues before it fires forms one pool, which is then paired by standings. Without a window the
   * 2nd player to arrive would always be paired instantly and standings could never matter.
   * PAIRING_WINDOW_MS=0 pairs immediately.
   */
  private async schedulePairing(tournamentId: string) {
    const windowMs = this.config.get<number>('PAIRING_WINDOW_MS') ?? 1500;
    if (windowMs <= 0) {
      await this.pairWaitingPlayers(tournamentId);
      return;
    }
    if (this.pairingTimers.has(tournamentId)) return; // a run is already pending for this pool
    const timer = setTimeout(() => {
      this.pairingTimers.delete(tournamentId);
      this.pairWaitingPlayers(tournamentId).catch((e: unknown) =>
        this.logger.error(`Pairing failed for ${tournamentId}: ${String(e)}`),
      );
    }, windowMs);
    timer.unref?.();
    this.pairingTimers.set(tournamentId, timer);
  }

  async leaveQueue(userId: string, reason: 'left' | 'disconnected' = 'left'): Promise<QueueStatusPayload> {
    const [removed] = await this.db
      .delete(matchmakingQueue)
      .where(eq(matchmakingQueue.userId, userId))
      .returning({ tournamentId: matchmakingQueue.tournamentId });
    const status: QueueStatusPayload = {
      waiting: false,
      tournamentId: removed?.tournamentId ?? null,
      reason,
    };
    if (removed) this.realtime.toUser(userId, ServerEvents.QueueStatus, status);
    return status;
  }

  /** Current queue state for a (re)connecting client */
  async statusFor(userId: string): Promise<QueueStatusPayload> {
    const [row] = await this.db
      .select({ tournamentId: matchmakingQueue.tournamentId, since: matchmakingQueue.enqueuedAt })
      .from(matchmakingQueue)
      .where(eq(matchmakingQueue.userId, userId));
    return row
      ? { waiting: true, tournamentId: row.tournamentId, since: row.since.toISOString() }
      : { waiting: false, tournamentId: null };
  }

  /**
   * Pair waiting players until fewer than two remain.
   *
   * Concurrency: a transaction-scoped advisory lock per tournament serialises pairing runs, so two
   * simultaneous "Find opponent" clicks can't each see only themselves and both keep waiting.
   * `active_players` (PK user_id) is the DB-level backstop against double-booking.
   */
  async pairWaitingPlayers(tournamentId: string): Promise<CreatedMatch[]> {
    const created: CreatedMatch[] = [];

    for (;;) {
      const match = await this.db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${tournamentId}, 0))`);

        const [t] = await tx
          .select({
            status: tournaments.status,
            format: tournaments.format,
            baseSeconds: tournaments.baseSeconds,
            incrementSeconds: tournaments.incrementSeconds,
          })
          .from(tournaments)
          .where(eq(tournaments.id, tournamentId))
          .for('share');
        if (!t || t.status !== 'ongoing') return null;

        const waiting = await tx
          .select({
            id: matchmakingQueue.id,
            userId: matchmakingQueue.userId,
            enqueuedAt: matchmakingQueue.enqueuedAt,
          })
          .from(matchmakingQueue)
          .where(
            and(
              eq(matchmakingQueue.tournamentId, tournamentId),
              // Defensive: skip anyone who is somehow already in a game
              notExists(
                tx.select().from(activePlayers).where(eq(activePlayers.userId, matchmakingQueue.userId)),
              ),
            ),
          )
          .for('update');

        // Standings-based: closest-ranked opponent, new opponents first; round robin never repeats
        const context = await this.pairingContext(tx, tournamentId);
        const pair = pickPair(waiting, { ...context, roundRobin: t.format === 'round_robin' });
        if (!pair) return null;

        const { whiteId, blackId } = assignColors(pair[0].userId, pair[1].userId);
        const startMs = t.baseSeconds * 1000;
        const [m] = await tx
          .insert(matches)
          .values({
            tournamentId,
            whiteId,
            blackId,
            baseSeconds: t.baseSeconds,
            incrementSeconds: t.incrementSeconds,
            whiteTimeMs: startMs,
            blackTimeMs: startMs,
            // White's clock starts now; a no-show eventually loses on time
            turnStartedAt: new Date(),
          })
          .returning({ id: matches.id });

        await tx.insert(activePlayers).values([
          { userId: whiteId, matchId: m.id },
          { userId: blackId, matchId: m.id },
        ]);
        await tx.delete(matchmakingQueue).where(inArray(matchmakingQueue.id, [pair[0].id, pair[1].id]));

        return { matchId: m.id, tournamentId, whiteId, blackId };
      });

      if (!match) break;
      created.push(match);
      await this.game.startClock(match.matchId); // server-side flag timer for white's first move
      await this.announce(match);
    }
    return created;
  }

  /** Who has already played whom (any status) + current half-points (completed games) */
  private async pairingContext(
    exec: Executor,
    tournamentId: string,
  ): Promise<Required<Omit<PairingContext, 'roundRobin'>>> {
    const games = await exec
      .select({ whiteId: matches.whiteId, blackId: matches.blackId, result: matches.result })
      .from(matches)
      .where(eq(matches.tournamentId, tournamentId));

    const played = new Set<string>();
    const halfPoints = new Map<string, number>();
    const add = (id: string, h: number) => halfPoints.set(id, (halfPoints.get(id) ?? 0) + h);
    for (const g of games) {
      played.add(pairKey(g.whiteId, g.blackId));
      if (g.result === 'white_win') add(g.whiteId, 2);
      else if (g.result === 'black_win') add(g.blackId, 2);
      else if (g.result === 'draw') {
        add(g.whiteId, 1);
        add(g.blackId, 1);
      }
    }
    return { played, halfPoints };
  }

  /** Round robin: participants this player has no game with yet */
  private async opponentsLeft(exec: Executor, tournamentId: string, userId: string): Promise<number> {
    const [participants, { played }] = await Promise.all([
      exec
        .select({ userId: tournamentParticipants.userId })
        .from(tournamentParticipants)
        .where(eq(tournamentParticipants.tournamentId, tournamentId)),
      this.pairingContext(exec, tournamentId),
    ]);
    return participants.filter((p) => p.userId !== userId && !played.has(pairKey(p.userId, userId))).length;
  }

  private async announce(m: CreatedMatch) {
    const players = await this.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, [m.whiteId, m.blackId]));
    const name = (id: string) => players.find((p) => p.id === id)?.name ?? 'Opponent';

    for (const [me, opp, color] of [
      [m.whiteId, m.blackId, 'white'],
      [m.blackId, m.whiteId, 'black'],
    ] as const) {
      this.realtime.toUser(me, ServerEvents.QueueStatus, {
        waiting: false,
        tournamentId: m.tournamentId,
        reason: 'matched',
      } satisfies QueueStatusPayload);
      this.realtime.toUser(me, ServerEvents.MatchFound, {
        matchId: m.matchId,
        tournamentId: m.tournamentId,
        color,
        opponent: { id: opp, name: name(opp) },
      } satisfies MatchFoundPayload);
    }
    this.realtime.toAll(ServerEvents.TournamentUpdated, { tournamentId: m.tournamentId });
    this.logger.log(`Paired ${name(m.whiteId)} (white) vs ${name(m.blackId)} (black) → ${m.matchId}`);
  }
}
