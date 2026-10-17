/** Mirror of apps/api/src/realtime/events.ts — the Socket.IO contract */

export const ClientEvents = {
  QueueJoin: "queue:join",
  QueueLeave: "queue:leave",
} as const;

export const ServerEvents = {
  QueueStatus: "queue:status",
  MatchFound: "match:found",
} as const;

export type QueueStatus =
  | { waiting: true; tournamentId: string; since: string }
  | {
      waiting: false;
      tournamentId: string | null;
      reason?: "left" | "matched" | "tournament_closed" | "disconnected";
    };

export interface MatchFound {
  matchId: string;
  tournamentId: string;
  color: "white" | "black";
  opponent: { id: string; name: string };
}

export interface WsError {
  code: string;
  message: string;
  details?: unknown;
}

export type Ack<T> = { success: true; data: T } | { success: false; error: WsError };
