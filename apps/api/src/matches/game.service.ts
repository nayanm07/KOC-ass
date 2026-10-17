import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { DRIZZLE, type Database } from '../db/db.module';
import { activePlayers, matches, matchMoves, type Match } from '../db/schema';
import { matchRoom, ServerEvents, userRoom, type MatchEndedPayload } from '../realtime/events';
import { RealtimeService } from '../realtime/realtime.service';
import { applyMoveToClock, liveClock, opposite, turnFromFen, type Color } from './clock';
import { DrawOffers } from './draw-offers';
import type { MoveDto } from './dto/match.dto';
import {
  finalPgn,
  loadGame,
  MoveRejected,
  playMove,
  resignOutcome,
  timeoutOutcome,
  type Outcome,
} from './game.rules';
import { colorOf, matchNotFound, MatchesService, type MatchView } from './matches.service';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Small grace period so the server never flags a player a hair before their clock really hits 0 */
const FLAG_GRACE_MS = 100;

/**
 * Server-authoritative game engine. Clients only *propose* moves; this service validates turn +
 * legality, owns the clock, detects every game end, persists everything and broadcasts the result.
 */
@Injectable()
export class GameService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(GameService.name);
  private readonly flagTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly matchesService: MatchesService,
    private readonly realtime: RealtimeService,
    private readonly drawOffers: DrawOffers,
  ) {}

  /* ─────────────────────── Lifecycle ─────────────────────── */

  /** Re-arm flag timers for games that were live when the server stopped */
  async onApplicationBootstrap() {
    const live = await this.db.select().from(matches).where(eq(matches.status, 'ongoing'));
    for (const m of live) this.armFlagTimer(m);
    if (live.length) this.logger.log(`Re-armed clocks for ${live.length} live game(s)`);
  }

  onApplicationShutdown() {
    for (const t of this.flagTimers.values()) clearTimeout(t);
    this.flagTimers.clear();
  }

  /** Called by matchmaking right after a match is created */
  async startClock(matchId: string) {
    const [m] = await this.db.select().from(matches).where(eq(matches.id, matchId));
    if (m) this.armFlagTimer(m);
  }

  /* ──────────────────────── Actions ──────────────────────── */

  async move(user: AuthUser, dto: MoveDto): Promise<{ ply: number }> {
    const now = new Date();
    const result = await this.db.transaction(async (tx) => {
      const m = await this.lockMatch(tx, dto.matchId);
      const color = this.assertPlayer(m, user);
      if (m.status !== 'ongoing') throw conflict('GAME_OVER', 'The game is already over');
      if (dto.ply !== undefined && dto.ply !== m.ply) {
        throw conflict('STALE_STATE', 'Your board was out of date — it has been refreshed');
      }
      if (turnFromFen(m.fen) !== color) throw conflict('NOT_YOUR_TURN', "It's not your turn");

      // Clock first: a move that arrives after the flag fell loses on time
      const clock = applyMoveToClock(m, color, m.incrementSeconds * 1000, now);
      if (clock.flagged) {
        await this.finish(tx, m, timeoutOutcome(m.fen, color), now, zeroClock(color));
        return { ply: m.ply, ended: true };
      }

      const game = loadGame(m.pgn, await this.pgnHeaders(m));
      let applied;
      try {
        applied = playMove(game, color, dto);
      } catch (e) {
        if (e instanceof MoveRejected) throw new BadRequestException({ code: e.code, message: e.message });
        throw e;
      }

      const ply = m.ply + 1;
      await tx.insert(matchMoves).values({
        matchId: m.id,
        ply,
        color,
        playedById: user.id,
        san: applied.san,
        fromSquare: applied.from,
        toSquare: applied.to,
        promotion: applied.promotion,
        fenAfter: applied.fen,
        thinkTimeMs: clock.thinkTimeMs,
        whiteTimeMs: clock.whiteTimeMs,
        blackTimeMs: clock.blackTimeMs,
      });

      await tx
        .update(matches)
        .set({
          fen: applied.fen,
          pgn: applied.pgn,
          ply,
          whiteTimeMs: clock.whiteTimeMs,
          blackTimeMs: clock.blackTimeMs,
          turnStartedAt: applied.outcome ? null : now,
        })
        .where(eq(matches.id, m.id));

      if (applied.outcome) {
        await this.finish(tx, { ...m, fen: applied.fen, pgn: applied.pgn, ply }, applied.outcome, now);
      }
      return { ply, ended: !!applied.outcome };
    });

    this.drawOffers.clear(dto.matchId); // a move implicitly declines a pending offer
    await this.afterChange(dto.matchId, result.ended);
    return { ply: result.ply };
  }

  async resign(user: AuthUser, matchId: string): Promise<{ resigned: true }> {
    await this.db.transaction(async (tx) => {
      const m = await this.lockMatch(tx, matchId);
      const color = this.assertPlayer(m, user);
      if (m.status !== 'ongoing') throw conflict('GAME_OVER', 'The game is already over');
      await this.finish(tx, m, resignOutcome(color), new Date(), this.frozenClocks(m));
    });
    await this.afterChange(matchId, true);
    return { resigned: true };
  }

  /** Offer a draw — or accept the opponent's standing offer */
  async offerDraw(user: AuthUser, matchId: string): Promise<{ drawOffer: Color | null; ended: boolean }> {
    const m = await this.loadOngoing(matchId);
    const color = this.assertPlayer(m, user);
    const pending = this.drawOffers.get(matchId);
    if (pending === opposite(color)) return this.respondDraw(user, matchId, true);
    if (pending === color) throw conflict('DRAW_ALREADY_OFFERED', 'You already offered a draw');

    this.drawOffers.set(matchId, color);
    await this.afterChange(matchId, false);
    return { drawOffer: color, ended: false };
  }

  async respondDraw(
    user: AuthUser,
    matchId: string,
    accept: boolean,
  ): Promise<{ drawOffer: Color | null; ended: boolean }> {
    const m = await this.loadOngoing(matchId);
    const color = this.assertPlayer(m, user);
    if (this.drawOffers.get(matchId) !== opposite(color)) {
      throw conflict('NO_DRAW_OFFER', 'There is no draw offer to respond to');
    }
    this.drawOffers.clear(matchId);

    if (!accept) {
      await this.afterChange(matchId, false);
      return { drawOffer: null, ended: false };
    }
    await this.db.transaction(async (tx) => {
      const locked = await this.lockMatch(tx, matchId);
      if (locked.status !== 'ongoing') throw conflict('GAME_OVER', 'The game is already over');
      await this.finish(tx, locked, { result: 'draw', reason: 'draw_agreement' }, new Date(), this.frozenClocks(locked));
    });
    await this.afterChange(matchId, true);
    return { drawOffer: null, ended: true };
  }

  /** Socket room authorisation: players + coaches (spectators) */
  async viewForJoin(user: AuthUser, matchId: string): Promise<MatchView> {
    return this.matchesService.getView(user, matchId);
  }

  /* ───────────────────────── Clock ───────────────────────── */

  private armFlagTimer(m: Match) {
    this.clearFlagTimer(m.id);
    if (m.status !== 'ongoing' || !m.turnStartedAt) return;
    const turn = turnFromFen(m.fen);
    const live = liveClock(m, turn, true, new Date());
    const remaining = turn === 'white' ? live.whiteMs : live.blackMs;
    const timer = setTimeout(() => void this.checkFlag(m.id), remaining + FLAG_GRACE_MS);
    timer.unref?.();
    this.flagTimers.set(m.id, timer);
  }

  private clearFlagTimer(matchId: string) {
    const t = this.flagTimers.get(matchId);
    if (t) clearTimeout(t);
    this.flagTimers.delete(matchId);
  }

  /** Timer fired: end the game on time if the side to move really has nothing left */
  private async checkFlag(matchId: string) {
    this.flagTimers.delete(matchId);
    try {
      const outcome = await this.db.transaction(async (tx) => {
        const m = await this.lockMatch(tx, matchId);
        if (m.status !== 'ongoing') return null;
        const turn = turnFromFen(m.fen);
        const live = liveClock(m, turn, true, new Date());
        const remaining = turn === 'white' ? live.whiteMs : live.blackMs;
        if (remaining > 0) {
          this.armFlagTimer(m); // a move landed meanwhile — re-arm for the new turn
          return null;
        }
        await this.finish(tx, m, timeoutOutcome(m.fen, turn), new Date(), zeroClock(turn));
        return true;
      });
      if (outcome) await this.afterChange(matchId, true);
    } catch (e) {
      this.logger.error(`Flag check failed for ${matchId}: ${String(e)}`);
    }
  }

  /* ──────────────────────── Helpers ──────────────────────── */

  /** Persist a final result. Runs inside the caller's transaction. */
  private async finish(
    tx: Tx,
    m: Match,
    outcome: Outcome,
    now: Date,
    clocks: Partial<Pick<Match, 'whiteTimeMs' | 'blackTimeMs'>> = {},
  ) {
    await tx
      .update(matches)
      .set({
        status: 'completed',
        result: outcome.result,
        endReason: outcome.reason,
        endedAt: now,
        turnStartedAt: null,
        pgn: finalPgn(m.pgn, await this.pgnHeaders(m), outcome.result),
        ...clocks,
      })
      .where(and(eq(matches.id, m.id), eq(matches.status, 'ongoing')));
    // Both players are free to queue again — in the same transaction as the result
    await tx.delete(activePlayers).where(eq(activePlayers.matchId, m.id));
  }

  /** Clock values at this instant (used when a game ends without a move) */
  private frozenClocks(m: Match): Pick<Match, 'whiteTimeMs' | 'blackTimeMs'> {
    const live = liveClock(m, turnFromFen(m.fen), true, new Date());
    return { whiteTimeMs: live.whiteMs, blackTimeMs: live.blackMs };
  }

  /** Broadcast the new state (and the result) after any change */
  private async afterChange(matchId: string, ended: boolean) {
    const m = await this.matchesService.loadWithNames(matchId);
    if (!m) return;
    const state = await this.matchesService.buildView(m, null);
    this.realtime.toMatch(matchId, ServerEvents.MatchState, state);

    if (ended || m.status === 'completed') {
      this.clearFlagTimer(matchId);
      this.drawOffers.clear(matchId);
      const payload: MatchEndedPayload = {
        matchId,
        tournamentId: m.tournamentId,
        result: m.result!,
        reason: m.endReason!,
        pgn: m.pgn,
      };
      // Room + both players' personal rooms (Socket.IO de-duplicates sockets in several rooms)
      this.realtime.toRooms([matchRoom(matchId), userRoom(m.whiteId), userRoom(m.blackId)], ServerEvents.MatchEnded, payload);
      this.logger.log(`Match ${matchId} ended: ${m.result} by ${m.endReason}`);
    } else {
      this.armFlagTimer(m);
    }
  }

  private async lockMatch(tx: Tx, id: string): Promise<Match> {
    const [m] = await tx.select().from(matches).where(eq(matches.id, id)).for('update');
    if (!m) throw matchNotFound();
    return m;
  }

  private async loadOngoing(id: string): Promise<Match> {
    const [m] = await this.db.select().from(matches).where(eq(matches.id, id));
    if (!m) throw matchNotFound();
    if (m.status !== 'ongoing') throw conflict('GAME_OVER', 'The game is already over');
    return m;
  }

  private assertPlayer(m: Match, user: AuthUser): Color {
    const color = colorOf(m, user.id);
    if (!color) {
      throw new ForbiddenException({ code: 'NOT_A_PARTICIPANT', message: 'Only the two players can do that' });
    }
    return color;
  }

  private async pgnHeaders(m: Match): Promise<Record<string, string>> {
    const full = await this.matchesService.loadWithNames(m.id);
    const d = m.startedAt;
    return {
      Event: full?.tournamentName ?? 'Kingdom of Chess tournament',
      Site: 'Kingdom of Chess',
      Date: `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`,
      White: full?.whiteName ?? 'White',
      Black: full?.blackName ?? 'Black',
      TimeControl: `${m.baseSeconds}+${m.incrementSeconds}`,
    };
  }
}

function zeroClock(c: Color): Partial<Pick<Match, 'whiteTimeMs' | 'blackTimeMs'>> {
  return c === 'white' ? { whiteTimeMs: 0 } : { blackTimeMs: 0 };
}

function conflict(code: string, message: string) {
  return new ConflictException({ code, message });
}
