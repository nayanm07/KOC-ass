/**
 * Socket.IO contract — single source of truth for event names and payloads (mirrored in the web app).
 * Client → server events are acknowledged with the same envelope as REST:
 *   { success: true, data } | { success: false, error: { code, message, details? } }
 */

export const ClientEvents = {
  QueueJoin: 'queue:join',
  QueueLeave: 'queue:leave',
} as const;

export const ServerEvents = {
  /** Your matchmaking state changed (joined, left, removed because the tournament ended, …) */
  QueueStatus: 'queue:status',
  /** You were paired — open the match */
  MatchFound: 'match:found',
} as const;

export interface QueueJoinPayload {
  tournamentId: string;
}

export type QueueStatusPayload =
  | { waiting: true; tournamentId: string; since: string }
  | { waiting: false; tournamentId: string | null; reason?: 'left' | 'matched' | 'tournament_closed' | 'disconnected' };

export interface MatchFoundPayload {
  matchId: string;
  tournamentId: string;
  color: 'white' | 'black';
  opponent: { id: string; name: string };
}

export interface WsError {
  code: string;
  message: string;
  details?: unknown;
}

export type Ack<T> = { success: true; data: T } | { success: false; error: WsError };

export const userRoom = (userId: string) => `user:${userId}`;
export const matchRoom = (matchId: string) => `match:${matchId}`;
