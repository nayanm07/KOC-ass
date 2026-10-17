import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { and, eq, inArray, notExists, sql } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { DRIZZLE, type Database } from '../db/db.module';
import { activePlayers, matches, matchmakingQueue, tournaments, users } from '../db/schema';
import {
  ServerEvents,
  type MatchFoundPayload,
  type QueueStatusPayload,
} from '../realtime/events';
import { RealtimeService } from '../realtime/realtime.service';
import { GameService } from '../matches/game.service';
import { checkCanQueue } from '../tournaments/tournament.rules';
import { TournamentsService } from '../tournaments/tournaments.service';
import { assignColors, pickPair } from './pairing';

interface CreatedMatch {
  matchId: string;
  tournamentId: string;
  whiteId: string;
  blackId: string;
}

@Injectable()
export class MatchmakingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tournamentsService: TournamentsService,
    private readonly realtime: RealtimeService,
    private readonly game: GameService,
  ) {}

  /**
   * Queue rows belong to live socket connections. After a restart no socket is connected,
   * so any leftover rows are stale. (Single-instance assumption — see README trade-offs.)
   */
  async onApplicationBootstrap() {
    const removed = await this.db.delete(matchmakingQueue).returning({ id: matchmakingQueue.id });
    if (removed.length) this.logger.log(`Cleared ${removed.length} stale queue entries`);
  }

  /** "Find opponent": validate, enqueue, then try to pair immediately */
  async joinQueue(user: AuthUser, tournamentId: string): Promise<QueueStatusPayload> {
    const since = await this.db.transaction(async (tx) => {
      const [t] = await tx
        .select({ status: tournaments.status })
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
        .for('share');
      if (!t || t.status === 'draft') {
        throw new NotFoundException({ code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found' });
      }

      const joined = await this.tournamentsService.isParticipant(tx, tournamentId, user.id);
      const v = checkCanQueue({ status: t.status, joined });
      if (v) throw new ConflictException(v);

      // At most one match at a time: send them back to the game they're already in
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

    await this.pairWaitingPlayers(tournamentId);
    return status;
  }

  async leaveQueue(
    userId: string,
    reason: 'left' | 'disconnected' = 'left',
  ): Promise<QueueStatusPayload> {
    const [removed] = await this.db
      .delete(matchmakingQueue)
      .where(eq(matchmakingQueue.userId, userId))
      .returning({ tournamentId: matchmakingQueue.tournamentId });
    const status: QueueStatusPayload = { waiting: false, tournamentId: removed?.tournamentId ?? null, reason };
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
            baseSeconds: tournaments.baseSeconds,
            incrementSeconds: tournaments.incrementSeconds,
          })
          .from(tournaments)
          .where(eq(tournaments.id, tournamentId))
          .for('share');
        if (!t || t.status !== 'ongoing') return null;

        const waiting = await tx
          .select({ id: matchmakingQueue.id, userId: matchmakingQueue.userId, enqueuedAt: matchmakingQueue.enqueuedAt })
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

        const pair = pickPair(waiting);
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
