import type { TournamentStatus, UserRole } from '../db/schema';

/**
 * Pure tournament business rules — no DB, no Nest — so they're trivially unit-testable.
 * Each check returns `null` when allowed, or a { code, message } describing why not.
 */

export interface RuleViolation {
  code: string;
  message: string;
}

/** Lifecycle: draft ⇄ open → ongoing → completed (completed is final) */
const TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ['open'],
  open: ['draft', 'ongoing'],
  ongoing: ['completed'],
  completed: [],
};

export function allowedTransitions(from: TournamentStatus): TournamentStatus[] {
  return TRANSITIONS[from];
}

export function checkStatusTransition(
  from: TournamentStatus,
  to: TournamentStatus,
  ctx: { participantCount: number; liveMatchCount: number },
): RuleViolation | null {
  if (from === to) {
    return { code: 'INVALID_STATUS_TRANSITION', message: `Tournament is already ${to}` };
  }
  if (!TRANSITIONS[from].includes(to)) {
    return { code: 'INVALID_STATUS_TRANSITION', message: `Cannot move a tournament from ${from} to ${to}` };
  }
  if (from === 'open' && to === 'draft' && ctx.participantCount > 0) {
    return {
      code: 'TOURNAMENT_HAS_PARTICIPANTS',
      message: 'Students have already joined — it can no longer go back to draft',
    };
  }
  if (to === 'ongoing' && ctx.participantCount < 2) {
    return { code: 'NOT_ENOUGH_PARTICIPANTS', message: 'At least 2 participants are needed to start' };
  }
  if (to === 'completed' && ctx.liveMatchCount > 0) {
    return {
      code: 'TOURNAMENT_HAS_LIVE_MATCHES',
      message: `${ctx.liveMatchCount} game(s) still in progress — wait for them to finish`,
    };
  }
  return null;
}

/** Students self-join while registration is open (status `open`). */
export function checkCanJoin(ctx: {
  role: UserRole;
  status: TournamentStatus;
  alreadyJoined: boolean;
}): RuleViolation | null {
  if (ctx.role !== 'student') {
    return { code: 'ONLY_STUDENTS_CAN_JOIN', message: 'Only students can join tournaments' };
  }
  if (ctx.alreadyJoined) {
    return { code: 'ALREADY_JOINED', message: 'You have already joined this tournament' };
  }
  if (ctx.status !== 'open') {
    return {
      code: 'TOURNAMENT_NOT_OPEN',
      message:
        ctx.status === 'draft'
          ? 'This tournament is not open for registration yet'
          : 'Registration for this tournament has closed',
    };
  }
  return null;
}

/** Leaving is only possible before the tournament starts. */
export function checkCanLeave(ctx: { status: TournamentStatus; joined: boolean }): RuleViolation | null {
  if (!ctx.joined) return { code: 'NOT_JOINED', message: 'You are not part of this tournament' };
  if (ctx.status !== 'open') {
    return { code: 'TOURNAMENT_NOT_OPEN', message: 'You can only leave before the tournament starts' };
  }
  return null;
}

/**
 * Players may queue for games only while the tournament is being played.
 * Round robin: only while they still have opponents left to play.
 */
export function checkCanQueue(ctx: {
  status: TournamentStatus;
  joined: boolean;
  /** Round robin only: opponents this player hasn't met yet (incl. a game in progress) */
  opponentsLeft?: number;
}): RuleViolation | null {
  if (!ctx.joined) return { code: 'NOT_JOINED', message: 'Join the tournament first' };
  if (ctx.status !== 'ongoing') {
    return {
      code: 'TOURNAMENT_NOT_ONGOING',
      message:
        ctx.status === 'completed' ? 'This tournament has finished' : 'The tournament has not started yet',
    };
  }
  if (ctx.opponentsLeft !== undefined && ctx.opponentsLeft <= 0) {
    return {
      code: 'ROUND_ROBIN_DONE',
      message: "You've played everyone in this round robin — wait for the final standings",
    };
  }
  return null;
}

/** Round robin: every pair plays once → n(n−1)/2 games */
export function roundRobinGameCount(players: number): number {
  return players < 2 ? 0 : (players * (players - 1)) / 2;
}

/** Round robin auto-completion: every pairing has a finished game and nothing is still live */
export function isRoundRobinFinished(ctx: {
  players: number;
  completedGames: number;
  liveGames: number;
}): boolean {
  const total = roundRobinGameCount(ctx.players);
  return total > 0 && ctx.liveGames === 0 && ctx.completedGames >= total;
}

/** Which fields a coach may edit in each status. */
export function checkCanEdit(
  status: TournamentStatus,
  fields: { schedule: boolean; timeControl: boolean; format?: boolean },
): RuleViolation | null {
  if (status === 'completed') {
    return { code: 'TOURNAMENT_COMPLETED', message: 'A completed tournament can no longer be edited' };
  }
  if (status === 'ongoing' && (fields.timeControl || fields.schedule || fields.format)) {
    return {
      code: 'TOURNAMENT_LOCKED',
      message: 'Format, time control and start time are locked once the tournament has started',
    };
  }
  return null;
}

/** Only tournaments that never started can be deleted — played games are history. */
export function checkCanDelete(status: TournamentStatus): RuleViolation | null {
  if (status === 'ongoing' || status === 'completed') {
    return {
      code: 'TOURNAMENT_HAS_STARTED',
      message: 'Started tournaments cannot be deleted, to preserve match history',
    };
  }
  return null;
}

/** "5+3" style label */
export function formatTimeControl(baseSeconds: number, incrementSeconds: number): string {
  const minutes = baseSeconds / 60;
  const base = Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
  return `${base}+${incrementSeconds}`;
}
