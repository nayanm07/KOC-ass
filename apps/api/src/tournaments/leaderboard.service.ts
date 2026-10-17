import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DRIZZLE, type Database } from '../db/db.module';
import { matches, tournamentParticipants, users, type Match } from '../db/schema';
import { computeStandings, declareWinner, type StandingRow } from './standings';

type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export interface LeaderboardView {
  standings: StandingRow[];
  /** Declared winner (set when the coach completes the tournament) */
  winner: { userId: string; name: string } | null;
  /** Current sole leader while still in progress (null if tied / no games) */
  leader: { userId: string; name: string } | null;
  stats: { players: number; gamesPlayed: number; liveGames: number; whiteWins: number; blackWins: number; draws: number };
}

export interface TournamentMatchRow {
  id: string;
  white: { id: string; name: string };
  black: { id: string; name: string };
  status: Match['status'];
  result: Match['result'];
  endReason: Match['endReason'];
  moves: number;
  startedAt: Date;
  endedAt: Date | null;
}

@Injectable()
export class LeaderboardService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async standings(tournamentId: string, exec: Executor = this.db): Promise<StandingRow[]> {
    const [players, games] = await Promise.all([
      exec
        .select({ userId: tournamentParticipants.userId, name: users.name })
        .from(tournamentParticipants)
        .innerJoin(users, eq(users.id, tournamentParticipants.userId))
        .where(eq(tournamentParticipants.tournamentId, tournamentId)),
      exec
        .select({ whiteId: matches.whiteId, blackId: matches.blackId, result: matches.result })
        .from(matches)
        .where(and(eq(matches.tournamentId, tournamentId), eq(matches.status, 'completed'))),
    ]);
    return computeStandings(
      players,
      games.flatMap((g) => (g.result ? [{ whiteId: g.whiteId, blackId: g.blackId, result: g.result }] : [])),
    );
  }

  /** Winner to record when the tournament is completed (null if first place is shared) */
  async computeWinnerId(tournamentId: string, exec: Executor): Promise<string | null> {
    return declareWinner(await this.standings(tournamentId, exec))?.userId ?? null;
  }

  async leaderboard(tournamentId: string, winner: { id: string; name: string } | null): Promise<LeaderboardView> {
    const [standings, [counts]] = await Promise.all([
      this.standings(tournamentId),
      this.db
        .select({
          gamesPlayed: sql<number>`count(*) filter (where ${matches.status} = 'completed')::int`,
          liveGames: sql<number>`count(*) filter (where ${matches.status} = 'ongoing')::int`,
          whiteWins: sql<number>`count(*) filter (where ${matches.result} = 'white_win')::int`,
          blackWins: sql<number>`count(*) filter (where ${matches.result} = 'black_win')::int`,
          draws: sql<number>`count(*) filter (where ${matches.result} = 'draw')::int`,
        })
        .from(matches)
        .where(eq(matches.tournamentId, tournamentId)),
    ]);
    const leader = declareWinner(standings);
    return {
      standings,
      winner: winner ? { userId: winner.id, name: winner.name } : null,
      leader: leader ? { userId: leader.userId, name: leader.name } : null,
      stats: { players: standings.length, ...counts },
    };
  }

  /** Per-match results (live games first, then most recent) */
  async tournamentMatches(tournamentId: string): Promise<TournamentMatchRow[]> {
    const white = alias(users, 'white');
    const black = alias(users, 'black');
    const rows = await this.db
      .select({
        id: matches.id,
        whiteId: matches.whiteId,
        whiteName: white.name,
        blackId: matches.blackId,
        blackName: black.name,
        status: matches.status,
        result: matches.result,
        endReason: matches.endReason,
        moves: matches.ply,
        startedAt: matches.startedAt,
        endedAt: matches.endedAt,
      })
      .from(matches)
      .innerJoin(white, eq(white.id, matches.whiteId))
      .innerJoin(black, eq(black.id, matches.blackId))
      .where(eq(matches.tournamentId, tournamentId))
      .orderBy(asc(sql`case ${matches.status} when 'ongoing' then 0 else 1 end`), desc(matches.startedAt));

    return rows.map((r) => ({
      id: r.id,
      white: { id: r.whiteId, name: r.whiteName },
      black: { id: r.blackId, name: r.blackName },
      status: r.status,
      result: r.result,
      endReason: r.endReason,
      moves: r.moves,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
    }));
  }
}
