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
