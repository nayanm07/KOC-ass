import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AuthUser } from '../auth/auth.types';
import { DRIZZLE, type Database } from '../db/db.module';
import { activePlayers, matches, matchMoves, tournaments, users, type Match } from '../db/schema';
import { formatTimeControl } from '../tournaments/tournament.rules';
import { liveClock, turnFromFen, type Color } from './clock';
import { DrawOffers } from './draw-offers';

export type MatchWithNames = Match & { tournamentName: string; whiteName: string; blackName: string };

export interface MatchView {
  id: string;
  tournament: { id: string; name: string };
  white: { id: string; name: string };
  black: { id: string; name: string };
  status: Match['status'];
  result: Match['result'];
  endReason: Match['endReason'];
  fen: string;
  pgn: string;
  ply: number;
  turn: Color;
  lastMove: { from: string; to: string; san: string } | null;
  drawOffer: Color | null;
  timeControl: { baseSeconds: number; incrementSeconds: number; label: string };
  /** Live clock values at `serverNow`; clients tick the `running` side down from there */
  clock: { whiteMs: number; blackMs: number; running: Color | null; serverNow: string };
  startedAt: Date;
  endedAt: Date | null;
  /** The viewer's colour, or null for a spectator / broadcast */
  yourColor: Color | null;
}

export interface MyMatchRow {
  id: string;
  tournament: { id: string; name: string };
  color: Color;
  opponent: { id: string; name: string };
  status: Match['status'];
  /** From my point of view */
  outcome: 'win' | 'loss' | 'draw' | null;
  endReason: Match['endReason'];
  moves: number;
  startedAt: Date;
  endedAt: Date | null;
}

export const matchNotFound = () =>
  new NotFoundException({ code: 'MATCH_NOT_FOUND', message: 'Match not found' });

export const colorOf = (m: Pick<Match, 'whiteId' | 'blackId'>, userId: string): Color | null =>
  m.whiteId === userId ? 'white' : m.blackId === userId ? 'black' : null;

@Injectable()
export class MatchesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly drawOffers: DrawOffers,
  ) {}

  /** Players see their own games; coaches can watch any game */
  async getView(viewer: AuthUser, id: string): Promise<MatchView> {
    const m = await this.loadWithNames(id);
    if (!m) throw matchNotFound();
    this.assertCanView(m, viewer);
    return this.buildView(m, viewer.id);
  }

  assertCanView(m: Pick<Match, 'whiteId' | 'blackId'>, viewer: AuthUser) {
    if (!colorOf(m, viewer.id) && viewer.role !== 'coach') {
      throw new ForbiddenException({
        code: 'NOT_A_PARTICIPANT',
        message: 'You are not playing in this match',
      });
    }
  }

  /** My games across all tournaments, newest first */
  async myMatches(userId: string): Promise<MyMatchRow[]> {
    const white = alias(users, 'white');
    const black = alias(users, 'black');
    const rows = await this.db
      .select({
        match: matches,
        tournamentName: tournaments.name,
        whiteName: white.name,
        blackName: black.name,
      })
      .from(matches)
      .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
      .innerJoin(white, eq(white.id, matches.whiteId))
      .innerJoin(black, eq(black.id, matches.blackId))
      .where(or(eq(matches.whiteId, userId), eq(matches.blackId, userId)))
      .orderBy(desc(matches.startedAt));

    return rows.map(({ match: m, tournamentName, whiteName, blackName }) => {
      const color: Color = m.whiteId === userId ? 'white' : 'black';
      const outcome =
        m.result === null
          ? null
          : m.result === 'draw'
            ? 'draw'
            : (m.result === 'white_win') === (color === 'white')
              ? 'win'
              : 'loss';
      return {
        id: m.id,
        tournament: { id: m.tournamentId, name: tournamentName },
        color,
        opponent: color === 'white' ? { id: m.blackId, name: blackName } : { id: m.whiteId, name: whiteName },
        status: m.status,
        outcome,
        endReason: m.endReason,
        moves: m.ply,
        startedAt: m.startedAt,
        endedAt: m.endedAt,
      };
    });
  }

  /** The viewer's in-progress match, if any (used to resume after a refresh) */
  async currentMatchId(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ matchId: activePlayers.matchId })
      .from(activePlayers)
      .where(eq(activePlayers.userId, userId));
    return row?.matchId ?? null;
  }

  async loadWithNames(id: string): Promise<MatchWithNames | null> {
    const white = alias(users, 'white');
    const black = alias(users, 'black');
    const [row] = await this.db
      .select({
        match: matches,
        tournamentName: tournaments.name,
        whiteName: white.name,
        blackName: black.name,
      })
      .from(matches)
      .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
      .innerJoin(white, eq(white.id, matches.whiteId))
      .innerJoin(black, eq(black.id, matches.blackId))
      .where(eq(matches.id, id));
    return row
      ? {
          ...row.match,
          tournamentName: row.tournamentName,
          whiteName: row.whiteName,
          blackName: row.blackName,
        }
      : null;
  }

  async buildView(m: MatchWithNames, viewerId: string | null, now = new Date()): Promise<MatchView> {
    const [last] = await this.db
      .select({ from: matchMoves.fromSquare, to: matchMoves.toSquare, san: matchMoves.san })
      .from(matchMoves)
      .where(eq(matchMoves.matchId, m.id))
      .orderBy(desc(matchMoves.ply))
      .limit(1);

    const turn = turnFromFen(m.fen);
    const isLive = m.status === 'ongoing';
    const clock = liveClock(m, turn, isLive, now);
    return {
      id: m.id,
      tournament: { id: m.tournamentId, name: m.tournamentName },
      white: { id: m.whiteId, name: m.whiteName },
      black: { id: m.blackId, name: m.blackName },
      status: m.status,
      result: m.result,
      endReason: m.endReason,
      fen: m.fen,
      pgn: m.pgn,
      ply: m.ply,
      turn,
      lastMove: last ?? null,
      drawOffer: isLive ? this.drawOffers.get(m.id) : null,
      timeControl: {
        baseSeconds: m.baseSeconds,
        incrementSeconds: m.incrementSeconds,
        label: formatTimeControl(m.baseSeconds, m.incrementSeconds),
      },
      clock: { ...clock, serverNow: now.toISOString() },
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      yourColor: viewerId ? colorOf(m, viewerId) : null,
    };
  }
}
