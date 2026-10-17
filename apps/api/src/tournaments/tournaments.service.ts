import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, getTableColumns, inArray, ne, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AuthUser } from '../auth/auth.types';
import { ServerEvents, type QueueStatusPayload } from '../realtime/events';
import { RealtimeService } from '../realtime/realtime.service';
import { DRIZZLE, type Database } from '../db/db.module';
import {
  matches,
  matchmakingQueue,
  tournamentParticipants,
  tournaments,
  users,
  type Tournament,
  type TournamentStatus,
} from '../db/schema';
import type { CreateTournamentDto } from './dto/create-tournament.dto';
import type { ListTournamentsQuery } from './dto/list-tournaments.query';
import type { UpdateTournamentDto } from './dto/update-tournament.dto';
import { LeaderboardService, type LeaderboardView, type TournamentMatchRow } from './leaderboard.service';
import {
  allowedTransitions,
  checkCanDelete,
  checkCanEdit,
  checkCanJoin,
  checkCanLeave,
  checkStatusTransition,
  formatTimeControl,
  type RuleViolation,
} from './tournament.rules';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Executor = Database | Tx;

export interface TournamentView {
  id: string;
  name: string;
  description: string | null;
  status: TournamentStatus;
  timeControl: { baseSeconds: number; incrementSeconds: number; label: string };
  startsAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdBy: { id: string; name: string };
  winner: { id: string; name: string } | null;
  participantCount: number;
  isJoined: boolean;
  /** Status changes a coach may make next (UI uses this to render actions) */
  allowedTransitions: TournamentStatus[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TournamentDetailView extends TournamentView {
  participants: { userId: string; name: string; joinedAt: Date }[];
}

/** Students never see drafts */
const STUDENT_VISIBLE: TournamentStatus[] = ['open', 'ongoing', 'completed'];

const notFound = () =>
  new NotFoundException({ code: 'TOURNAMENT_NOT_FOUND', message: 'Tournament not found' });

const violation = (v: RuleViolation) => new ConflictException(v);

@Injectable()
export class TournamentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly realtime: RealtimeService,
    private readonly leaderboards: LeaderboardService,
  ) {}

  /* ───────────────────────── Reads ───────────────────────── */

  async list(viewer: AuthUser, query: ListTournamentsQuery): Promise<TournamentView[]> {
    const filters: SQL[] = [];
    if (viewer.role === 'student') filters.push(inArray(tournaments.status, STUDENT_VISIBLE));
    if (query.status?.length) filters.push(inArray(tournaments.status, query.status));
    if (query.joined) filters.push(this.isJoinedSql(viewer.id));

    const rows = await this.baseSelect(this.db, viewer.id)
      .where(and(...filters))
      .orderBy(
        // Most relevant first: live → registering → draft → finished
        sql`case ${tournaments.status} when 'ongoing' then 0 when 'open' then 1 when 'draft' then 2 else 3 end`,
        asc(tournaments.startsAt),
      );
    return rows.map((r) => this.toView(r));
  }

  async findOne(viewer: AuthUser, id: string): Promise<TournamentDetailView> {
    const [row] = await this.baseSelect(this.db, viewer.id).where(eq(tournaments.id, id));
    if (!row || (viewer.role === 'student' && !STUDENT_VISIBLE.includes(row.status))) throw notFound();

    const participants = await this.db
      .select({
        userId: tournamentParticipants.userId,
        name: users.name,
        joinedAt: tournamentParticipants.joinedAt,
      })
      .from(tournamentParticipants)
      .innerJoin(users, eq(users.id, tournamentParticipants.userId))
      .where(eq(tournamentParticipants.tournamentId, id))
      .orderBy(asc(tournamentParticipants.joinedAt));

    return { ...this.toView(row), participants };
  }

  /** Standings (win 1 / draw ½ / loss 0, tiebreaks documented in standings.ts) + stats */
  async leaderboard(viewer: AuthUser, id: string): Promise<LeaderboardView> {
    const t = await this.findOne(viewer, id); // visibility rules (students never see drafts)
    return this.leaderboards.leaderboard(id, t.winner);
  }

  /** Per-match results */
  async matches(viewer: AuthUser, id: string): Promise<TournamentMatchRow[]> {
    await this.findOne(viewer, id);
    return this.leaderboards.tournamentMatches(id);
  }

  /* ──────────────────────── Coach ──────────────────────── */

  async create(coach: AuthUser, dto: CreateTournamentDto): Promise<TournamentDetailView> {
    const [created] = await this.db
      .insert(tournaments)
      .values({
        name: dto.name,
        description: dto.description || null,
        baseSeconds: dto.baseMinutes * 60,
        incrementSeconds: dto.incrementSeconds,
        startsAt: new Date(dto.startsAt),
        status: dto.status ?? 'draft',
        createdById: coach.id,
      })
      .returning({ id: tournaments.id });
    this.announce(created.id);
    return this.findOne(coach, created.id);
  }

  async update(coach: AuthUser, id: string, dto: UpdateTournamentDto): Promise<TournamentDetailView> {
    await this.db.transaction(async (tx) => {
      const t = await this.lockTournament(tx, id, 'update');
      const v = checkCanEdit(t.status, {
        schedule: dto.startsAt !== undefined,
        timeControl: dto.baseMinutes !== undefined || dto.incrementSeconds !== undefined,
      });
      if (v) throw violation(v);

      await tx
        .update(tournaments)
        .set({
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description || null }),
          ...(dto.baseMinutes !== undefined && { baseSeconds: dto.baseMinutes * 60 }),
          ...(dto.incrementSeconds !== undefined && { incrementSeconds: dto.incrementSeconds }),
          ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
        })
        .where(eq(tournaments.id, id));
    });
    this.announce(id);
    return this.findOne(coach, id);
  }

  async updateStatus(coach: AuthUser, id: string, to: TournamentStatus): Promise<TournamentDetailView> {
    const dequeued = await this.db.transaction(async (tx) => {
      // FOR UPDATE: serialises against concurrent joins (which take FOR SHARE on the same row)
      const t = await this.lockTournament(tx, id, 'update');
      const [participantCount, liveMatchCount] = await Promise.all([
        this.countParticipants(tx, id),
        this.countLiveMatches(tx, id),
      ]);

      const v = checkStatusTransition(t.status, to, { participantCount, liveMatchCount });
      if (v) throw violation(v);

      const now = new Date();
      // Declare the winner from the final standings, atomically with the status change
      const winnerId = to === 'completed' ? await this.leaderboards.computeWinnerId(id, tx) : undefined;
      await tx
        .update(tournaments)
        .set({
          status: to,
          ...(to === 'ongoing' && { startedAt: now }),
          ...(to === 'completed' && { completedAt: now, winnerId }),
        })
        .where(eq(tournaments.id, id));

      // Nobody can keep waiting for a game in a finished tournament
      if (to !== 'completed') return [];
      return tx
        .delete(matchmakingQueue)
        .where(eq(matchmakingQueue.tournamentId, id))
        .returning({ userId: matchmakingQueue.userId });
    });

    for (const { userId } of dequeued) {
      this.realtime.toUser(userId, ServerEvents.QueueStatus, {
        waiting: false,
        tournamentId: id,
        reason: 'tournament_closed',
      } satisfies QueueStatusPayload);
    }
    this.announce(id);
    return this.findOne(coach, id);
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    await this.db.transaction(async (tx) => {
      const t = await this.lockTournament(tx, id, 'update');
      const v = checkCanDelete(t.status);
      if (v) throw violation(v);
      await tx.delete(tournaments).where(eq(tournaments.id, id)); // participants cascade
    });
    this.announce(id);
    return { id, deleted: true };
  }

  /* ─────────────────────── Student ─────────────────────── */

  async join(student: AuthUser, id: string): Promise<TournamentDetailView> {
    await this.db.transaction(async (tx) => {
      // FOR SHARE: status can't change under us while we insert
      const t = await this.lockTournament(tx, id, 'share');
      if (t.status === 'draft') throw notFound();

      const alreadyJoined = await this.isParticipant(tx, id, student.id);
      const v = checkCanJoin({ role: student.role, status: t.status, alreadyJoined });
      if (v) throw violation(v);

      // Unique (tournament_id, user_id) also covers a double-click race between two requests
      const inserted = await tx
        .insert(tournamentParticipants)
        .values({ tournamentId: id, userId: student.id })
        .onConflictDoNothing()
        .returning({ id: tournamentParticipants.id });
      if (!inserted.length) {
        throw violation({ code: 'ALREADY_JOINED', message: 'You have already joined this tournament' });
      }
    });
    this.announce(id);
    return this.findOne(student, id);
  }

  async leave(student: AuthUser, id: string): Promise<TournamentDetailView> {
    await this.db.transaction(async (tx) => {
      const t = await this.lockTournament(tx, id, 'share');
      if (t.status === 'draft') throw notFound();

      const joined = await this.isParticipant(tx, id, student.id);
      const v = checkCanLeave({ status: t.status, joined });
      if (v) throw violation(v);

      await tx
        .delete(tournamentParticipants)
        .where(
          and(eq(tournamentParticipants.tournamentId, id), eq(tournamentParticipants.userId, student.id)),
        );
    });
    this.announce(id);
    return this.findOne(student, id);
  }

  /* ─────────────────────── Helpers ─────────────────────── */

  /** Tell every open client this tournament changed, so lists / leaderboards refetch */
  private announce(tournamentId: string) {
    this.realtime.toAll(ServerEvents.TournamentUpdated, { tournamentId });
  }

  /** Exposed for matchmaking: is this user a participant of the tournament? */
  async isParticipant(exec: Executor, tournamentId: string, userId: string): Promise<boolean> {
    const [row] = await exec
      .select({ id: tournamentParticipants.id })
      .from(tournamentParticipants)
      .where(
        and(eq(tournamentParticipants.tournamentId, tournamentId), eq(tournamentParticipants.userId, userId)),
      )
      .limit(1);
    return !!row;
  }

  private async lockTournament(tx: Tx, id: string, mode: 'update' | 'share'): Promise<Tournament> {
    const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).for(mode);
    if (!t) throw notFound();
    return t;
  }

  private async countParticipants(exec: Executor, tournamentId: string): Promise<number> {
    const [{ n }] = await exec
      .select({ n: sql<number>`count(*)::int` })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId));
    return n;
  }

  private async countLiveMatches(exec: Executor, tournamentId: string): Promise<number> {
    const [{ n }] = await exec
      .select({ n: sql<number>`count(*)::int` })
      .from(matches)
      .where(and(eq(matches.tournamentId, tournamentId), ne(matches.status, 'completed')));
    return n;
  }

  private isJoinedSql(userId: string) {
    return sql<boolean>`exists (select 1 from ${tournamentParticipants} tp where tp.tournament_id = ${tournaments.id} and tp.user_id = ${userId})`;
  }

  private baseSelect(exec: Executor, viewerId: string) {
    const creator = alias(users, 'creator');
    const winner = alias(users, 'winner');
    return exec
      .select({
        ...getTableColumns(tournaments),
        creatorName: creator.name,
        winnerName: winner.name,
        participantCount: sql<number>`(select count(*)::int from ${tournamentParticipants} tp where tp.tournament_id = ${tournaments.id})`,
        isJoined: this.isJoinedSql(viewerId),
      })
      .from(tournaments)
      .innerJoin(creator, eq(creator.id, tournaments.createdById))
      .leftJoin(winner, eq(winner.id, tournaments.winnerId));
  }

  private toView(
    r: Tournament & { creatorName: string; winnerName: string | null; participantCount: number; isJoined: boolean },
  ): TournamentView {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      timeControl: {
        baseSeconds: r.baseSeconds,
        incrementSeconds: r.incrementSeconds,
        label: formatTimeControl(r.baseSeconds, r.incrementSeconds),
      },
      startsAt: r.startsAt,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      createdBy: { id: r.createdById, name: r.creatorName },
      winner: r.winnerId && r.winnerName ? { id: r.winnerId, name: r.winnerName } : null,
      participantCount: r.participantCount,
      isJoined: r.isJoined,
      allowedTransitions: allowedTransitions(r.status),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
