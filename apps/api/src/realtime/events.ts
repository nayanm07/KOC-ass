/**
 * Socket.IO contract — single source of truth for event names and payloads (mirrored in the web app).
 * Client → server events are acknowledged with the same envelope as REST:
 *   { success: true, data } | { success: false, error: { code, message, details? } }
 */

export const ClientEvents = {
  QueueJoin: 'queue:join',
  QueueLeave: 'queue:leave',
  /** Subscribe to a match room; ack = full MatchView (initial state / reconnect) */
  MatchJoin: 'match:join',
  MatchLeave: 'match:leave',
  MatchMove: 'match:move',
  MatchResign: 'match:resign',
  /** Offer a draw (or accept the opponent's standing offer) */
  MatchOfferDraw: 'match:offer-draw',
  MatchRespondDraw: 'match:respond-draw',
} as const;

export const ServerEvents = {
  /** Your matchmaking state changed (joined, left, removed because the tournament ended, …) */
  QueueStatus: 'queue:status',
  /** You were paired — open the match */
  MatchFound: 'match:found',
  /** Authoritative game state after every change (move, draw offer, end) — MatchView with yourColor=null */
  MatchState: 'match:state',
  /** The game is over and the result is saved */
  MatchEnded: 'match:ended',
  /** Broadcast to everyone: a tournament's data changed (join/leave/status/game start/end) — refetch */
  TournamentUpdated: 'tournament:updated',
} as const;

export interface QueueJoinPayload {
  tournamentId: string;
}

export type QueueStatusPayload =
  | { waiting: true; tournamentId: string; since: string }
  | {
      waiting: false;
      tournamentId: string | null;
      reason?: 'left' | 'matched' | 'tournament_closed' | 'disconnected';
    };

export interface MatchFoundPayload {
  matchId: string;
  tournamentId: string;
  color: 'white' | 'black';
  opponent: { id: string; name: string };
}

export interface MatchEndedPayload {
  matchId: string;
  tournamentId: string;
  result: 'white_win' | 'black_win' | 'draw';
  reason: string;
  pgn: string;
}

export interface WsError {
  code: string;
  message: string;
  details?: unknown;
}

export type Ack<T> = { success: true; data: T } | { success: false; error: WsError };

export const userRoom = (userId: string) => `user:${userId}`;
export const matchRoom = (matchId: string) => `match:${matchId}`;
