export type Role = "coach" | "student";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TournamentStatus = "draft" | "open" | "ongoing" | "completed";

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  status: TournamentStatus;
  timeControl: { baseSeconds: number; incrementSeconds: number; label: string };
  startsAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: { id: string; name: string };
  winner: { id: string; name: string } | null;
  participantCount: number;
  isJoined: boolean;
  allowedTransitions: TournamentStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface TournamentDetail extends Tournament {
  participants: { userId: string; name: string; joinedAt: string }[];
}

export interface TournamentInput {
  name: string;
  description?: string;
  baseMinutes: number;
  incrementSeconds: number;
  startsAt: string;
  status?: "draft" | "open";
}

export type Color = "white" | "black";
export type MatchResult = "white_win" | "black_win" | "draw";
export type MatchEndReason =
  | "checkmate"
  | "resignation"
  | "timeout"
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "draw_agreement";

export interface MatchView {
  id: string;
  tournament: { id: string; name: string };
  white: { id: string; name: string };
  black: { id: string; name: string };
  status: "ongoing" | "completed";
  result: MatchResult | null;
  endReason: MatchEndReason | null;
  fen: string;
  pgn: string;
  ply: number;
  turn: Color;
  lastMove: { from: string; to: string; san: string } | null;
  drawOffer: Color | null;
  timeControl: { baseSeconds: number; incrementSeconds: number; label: string };
  clock: { whiteMs: number; blackMs: number; running: Color | null; serverNow: string };
  startedAt: string;
  endedAt: string | null;
  yourColor: Color | null;
}

export interface StandingRow {
  rank: number;
  userId: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  sonnebornBerger: number;
}

export interface Leaderboard {
  standings: StandingRow[];
  winner: { userId: string; name: string } | null;
  leader: { userId: string; name: string } | null;
  stats: { players: number; gamesPlayed: number; liveGames: number; whiteWins: number; blackWins: number; draws: number };
}

export interface TournamentMatchRow {
  id: string;
  white: { id: string; name: string };
  black: { id: string; name: string };
  status: "ongoing" | "completed";
  result: MatchResult | null;
  endReason: MatchEndReason | null;
  moves: number;
  startedAt: string;
  endedAt: string | null;
}

export interface MyMatchRow {
  id: string;
  tournament: { id: string; name: string };
  color: Color;
  opponent: { id: string; name: string };
  status: "ongoing" | "completed";
  outcome: "win" | "loss" | "draw" | null;
  endReason: MatchEndReason | null;
  moves: number;
  startedAt: string;
  endedAt: string | null;
}
