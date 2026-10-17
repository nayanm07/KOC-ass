import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/* ───────────────────────── Enums ───────────────────────── */

export const userRole = pgEnum('user_role', ['coach', 'student']);

export const tournamentStatus = pgEnum('tournament_status', [
  'draft',
  'open',
  'ongoing',
  'completed',
]);

export const matchStatus = pgEnum('match_status', ['ongoing', 'completed']);

export const matchResult = pgEnum('match_result', ['white_win', 'black_win', 'draw']);

export const matchEndReason = pgEnum('match_end_reason', [
  'checkmate',
  'resignation',
  'timeout',
  'stalemate',
  'insufficient_material',
  'threefold_repetition',
  'fifty_move_rule',
  'draw_agreement',
]);

export const pieceColor = pgEnum('piece_color', ['white', 'black']);

/* ──────────────────────── Helpers ──────────────────────── */

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** created_at / updated_at on every table; updated_at is bumped by Drizzle on every update. */
const timestamps = {
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/* ───────────────────────── Users ───────────────────────── */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    role: userRole('role').notNull(),
    lastLoginAt: timestamptz('last_login_at'),
    ...timestamps,
  },
  (t) => [
    // Case-insensitive uniqueness: "Alice@x.com" and "alice@x.com" are the same account
    uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`),
    index('users_role_idx').on(t.role),
  ],
);

/* ────────────────────── Tournaments ────────────────────── */

export const tournaments = pgTable(
  'tournaments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    /** Time control "5+3" = baseSeconds 300, incrementSeconds 3 */
    baseSeconds: integer('base_seconds').notNull(),
    incrementSeconds: integer('increment_seconds').notNull().default(0),
    status: tournamentStatus('status').notNull().default('draft'),
    startsAt: timestamptz('starts_at').notNull(),
    startedAt: timestamptz('started_at'),
    completedAt: timestamptz('completed_at'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    winnerId: uuid('winner_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('tournaments_status_starts_at_idx').on(t.status, t.startsAt),
    index('tournaments_created_by_idx').on(t.createdById),
    check('tournaments_base_seconds_ck', sql`${t.baseSeconds} BETWEEN 30 AND 10800`),
    check('tournaments_increment_seconds_ck', sql`${t.incrementSeconds} BETWEEN 0 AND 180`),
    check(
      'tournaments_completed_at_ck',
      sql`(${t.status} = 'completed') = (${t.completedAt} IS NOT NULL)`,
    ),
  ],
);

export const tournamentParticipants = pgTable(
  'tournament_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamptz('joined_at').notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('tournament_participants_tournament_user_uq').on(t.tournamentId, t.userId),
    index('tournament_participants_user_idx').on(t.userId),
  ],
);

/* ────────────────────── Matchmaking ────────────────────── */

/**
 * Durable matchmaking queue. One row per waiting player.
 * `user_id` is unique: a player can wait in at most one queue at a time.
 * Pairing uses SELECT … FOR UPDATE SKIP LOCKED so concurrent pairers never grab the same player.
 */
export const matchmakingQueue = pgTable(
  'matchmaking_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    enqueuedAt: timestamptz('enqueued_at').notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('matchmaking_queue_user_uq').on(t.userId),
    index('matchmaking_queue_tournament_enqueued_idx').on(t.tournamentId, t.enqueuedAt),
  ],
);

/* ──────────────────────── Matches ──────────────────────── */

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    whiteId: uuid('white_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    blackId: uuid('black_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: matchStatus('status').notNull().default('ongoing'),
    result: matchResult('result'),
    endReason: matchEndReason('end_reason'),

    /* Live game state — written on every move so a refresh/reconnect restores the game */
    fen: text('fen').notNull().default(STARTING_FEN),
    pgn: text('pgn').notNull().default(''),
    /** Half-moves played; also the optimistic-concurrency version of the game state */
    ply: integer('ply').notNull().default(0),

    /* Clock — time control is snapshotted so editing the tournament can't affect a live game */
    baseSeconds: integer('base_seconds').notNull(),
    incrementSeconds: integer('increment_seconds').notNull(),
    whiteTimeMs: integer('white_time_ms').notNull(),
    blackTimeMs: integer('black_time_ms').notNull(),
    /** When the side-to-move's clock started running (null once the game is over) */
    turnStartedAt: timestamptz('turn_started_at'),

    startedAt: timestamptz('started_at').notNull().defaultNow(),
    endedAt: timestamptz('ended_at'),
    ...timestamps,
  },
  (t) => [
    index('matches_tournament_status_idx').on(t.tournamentId, t.status),
    index('matches_white_idx').on(t.whiteId),
    index('matches_black_idx').on(t.blackId),
    check('matches_distinct_players_ck', sql`${t.whiteId} <> ${t.blackId}`),
    check('matches_clock_non_negative_ck', sql`${t.whiteTimeMs} >= 0 AND ${t.blackTimeMs} >= 0`),
    // A completed game always has a result, reason and end time; an ongoing one has none
    check(
      'matches_completion_consistent_ck',
      sql`(${t.status} = 'completed') = (${t.result} IS NOT NULL AND ${t.endReason} IS NOT NULL AND ${t.endedAt} IS NOT NULL)`,
    ),
  ],
);

/**
 * DB-level "never double-booked" guarantee.
 * A row exists while a player is in an ongoing match. user_id is the primary key, so a second
 * concurrent pairing for the same player fails with a unique violation and its transaction rolls back.
 * Rows are deleted in the same transaction that completes the match.
 */
export const activePlayers = pgTable(
  'active_players',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [index('active_players_match_idx').on(t.matchId)],
);

/**
 * Append-only move log: an audit trail and the source for move-list navigation.
 * UNIQUE(match_id, ply) means two racing writes for the same move can't both land.
 */
export const matchMoves = pgTable(
  'match_moves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    ply: integer('ply').notNull(),
    color: pieceColor('color').notNull(),
    playedById: uuid('played_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    san: varchar('san', { length: 16 }).notNull(),
    fromSquare: varchar('from_square', { length: 2 }).notNull(),
    toSquare: varchar('to_square', { length: 2 }).notNull(),
    promotion: varchar('promotion', { length: 1 }),
    fenAfter: text('fen_after').notNull(),
    /** Time the mover spent on this move, and both clocks after it (incl. increment) */
    thinkTimeMs: integer('think_time_ms').notNull(),
    whiteTimeMs: integer('white_time_ms').notNull(),
    blackTimeMs: integer('black_time_ms').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('match_moves_match_ply_uq').on(t.matchId, t.ply),
    check('match_moves_ply_positive_ck', sql`${t.ply} >= 1`),
  ],
);

/* ─────────────────────── Relations ─────────────────────── */

export const usersRelations = relations(users, ({ many }) => ({
  createdTournaments: many(tournaments, { relationName: 'creator' }),
  wonTournaments: many(tournaments, { relationName: 'winner' }),
  participations: many(tournamentParticipants),
  matchesAsWhite: many(matches, { relationName: 'white' }),
  matchesAsBlack: many(matches, { relationName: 'black' }),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [tournaments.createdById],
    references: [users.id],
    relationName: 'creator',
  }),
  winner: one(users, {
    fields: [tournaments.winnerId],
    references: [users.id],
    relationName: 'winner',
  }),
  participants: many(tournamentParticipants),
  matches: many(matches),
}));

export const tournamentParticipantsRelations = relations(tournamentParticipants, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournamentParticipants.tournamentId],
    references: [tournaments.id],
  }),
  user: one(users, { fields: [tournamentParticipants.userId], references: [users.id] }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [matches.tournamentId], references: [tournaments.id] }),
  white: one(users, { fields: [matches.whiteId], references: [users.id], relationName: 'white' }),
  black: one(users, { fields: [matches.blackId], references: [users.id], relationName: 'black' }),
  moves: many(matchMoves),
}));

export const matchMovesRelations = relations(matchMoves, ({ one }) => ({
  match: one(matches, { fields: [matchMoves.matchId], references: [matches.id] }),
}));

/* ───────────────────────── Types ───────────────────────── */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = (typeof userRole.enumValues)[number];
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type TournamentStatus = (typeof tournamentStatus.enumValues)[number];
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type MatchResult = (typeof matchResult.enumValues)[number];
export type MatchEndReason = (typeof matchEndReason.enumValues)[number];
export type MatchMove = typeof matchMoves.$inferSelect;
