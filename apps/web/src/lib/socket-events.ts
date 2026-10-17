/** Mirror of apps/api/src/realtime/events.ts — the Socket.IO contract */

export const ClientEvents = {
  QueueJoin: "queue:join",
  QueueLeave: "queue:leave",
  MatchJoin: "match:join",
  MatchLeave: "match:leave",
  MatchMove: "match:move",
  MatchResign: "match:resign",
  MatchOfferDraw: "match:offer-draw",
  MatchRespondDraw: "match:respond-draw",
} as const;

export const ServerEvents = {
  QueueStatus: "queue:status",
  MatchFound: "match:found",
  MatchState: "match:state",
  MatchEnded: "match:ended",
} as const;

export interface MatchEnded {
  matchId: string;
  tournamentId: string;
  result: "white_win" | "black_win" | "draw";
  reason: string;
  pgn: string;
}

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
