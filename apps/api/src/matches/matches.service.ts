import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AuthUser } from '../auth/auth.types';
import { DRIZZLE, type Database } from '../db/db.module';
import { activePlayers, matches, tournaments, users, type Match } from '../db/schema';
import { formatTimeControl } from '../tournaments/tournament.rules';
import { liveClock, turnFromFen, type Color } from './clock';

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
  timeControl: { baseSeconds: number; incrementSeconds: number; label: string };
  /** Live clock values at `serverNow`; clients tick the `running` side down from there */
  clock: { whiteMs: number; blackMs: number; running: Color | null; serverNow: string };
  startedAt: Date;
  endedAt: Date | null;
  /** The viewer's colour, or null for a spectator */
  yourColor: Color | null;
}

const notFound = () => new NotFoundException({ code: 'MATCH_NOT_FOUND', message: 'Match not found' });

@Injectable()
export class MatchesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Players see their own games; coaches can see any game */
  async getView(viewer: AuthUser, id: string): Promise<MatchView> {
    const row = await this.loadWithNames(id);
    if (!row) throw notFound();
    const isPlayer = row.whiteId === viewer.id || row.blackId === viewer.id;
    if (!isPlayer && viewer.role !== 'coach') {
      throw new ForbiddenException({ code: 'NOT_A_PARTICIPANT', message: 'You are not playing in this match' });
    }
    return this.toView(row, viewer.id);
  }

  /** The viewer's in-progress match, if any (used to resume after a refresh) */
  async currentMatchId(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ matchId: activePlayers.matchId })
      .from(activePlayers)
      .where(eq(activePlayers.userId, userId));
    return row?.matchId ?? null;
  }

  async loadWithNames(id: string) {
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
    return row ? { ...row.match, tournamentName: row.tournamentName, whiteName: row.whiteName, blackName: row.blackName } : null;
  }

  toView(
    m: Match & { tournamentName: string; whiteName: string; blackName: string },
    viewerId: string,
    now = new Date(),
  ): MatchView {
    const turn = turnFromFen(m.fen);
    const clock = liveClock(m, turn, m.status === 'ongoing', now);
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
      timeControl: {
        baseSeconds: m.baseSeconds,
        incrementSeconds: m.incrementSeconds,
        label: formatTimeControl(m.baseSeconds, m.incrementSeconds),
      },
      clock: { ...clock, serverNow: now.toISOString() },
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      yourColor: m.whiteId === viewerId ? 'white' : m.blackId === viewerId ? 'black' : null,
    };
  }
}
