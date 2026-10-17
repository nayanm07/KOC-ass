"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type {
  Leaderboard,
  Tournament,
  TournamentDetail,
  TournamentInput,
  TournamentMatchRow,
  TournamentStatus,
} from "@/lib/types";

export interface TournamentFilters {
  status?: TournamentStatus[];
  joined?: boolean;
}

export const tournamentKeys = {
  all: ["tournaments"] as const,
  list: (f: TournamentFilters = {}) => [...tournamentKeys.all, "list", f] as const,
  detail: (id: string) => [...tournamentKeys.all, "detail", id] as const,
  leaderboard: (id: string) => [...tournamentKeys.all, "leaderboard", id] as const,
  matches: (id: string) => [...tournamentKeys.all, "matches", id] as const,
};

function toQuery(f: TournamentFilters): string {
  const p = new URLSearchParams();
  if (f.status?.length) p.set("status", f.status.join(","));
  if (f.joined) p.set("joined", "true");
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function useTournaments(filters: TournamentFilters = {}) {
  return useQuery({
    queryKey: tournamentKeys.list(filters),
    queryFn: () => api<Tournament[]>(`/tournaments${toQuery(filters)}`),
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: tournamentKeys.detail(id),
    queryFn: () => api<TournamentDetail>(`/tournaments/${id}`),
  });
}

/** Live data: refreshed instantly by the `tournament:updated` socket ping (see SocketProvider) */
export function useLeaderboard(id: string) {
  return useQuery({
    queryKey: tournamentKeys.leaderboard(id),
    queryFn: () => api<Leaderboard>(`/tournaments/${id}/leaderboard`),
  });
}

export function useTournamentMatches(id: string) {
  return useQuery({
    queryKey: tournamentKeys.matches(id),
    queryFn: () => api<TournamentMatchRow[]>(`/tournaments/${id}/matches`),
  });
}

/** Every mutation refreshes all tournament lists + details, and seeds the detail cache with the response */
function useTournamentMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<TournamentDetail | { id: string; deleted: true }>,
  successMessage: (vars: TVars) => string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data, vars) => {
      if ("participants" in data) qc.setQueryData(tournamentKeys.detail(data.id), data);
      void qc.invalidateQueries({ queryKey: tournamentKeys.all });
      toast.success(successMessage(vars));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useCreateTournament() {
  return useTournamentMutation(
    (input: TournamentInput) => api<TournamentDetail>("/tournaments", { method: "POST", json: input }),
    (v) => `“${v.name}” created`,
  );
}

export function useUpdateTournament() {
  return useTournamentMutation(
    ({ id, input }: { id: string; input: Partial<TournamentInput> }) =>
      api<TournamentDetail>(`/tournaments/${id}`, { method: "PATCH", json: input }),
    () => "Tournament updated",
  );
}

const STATUS_TOAST: Record<TournamentStatus, string> = {
  draft: "Moved back to draft",
  open: "Registration is open",
  ongoing: "Tournament started — players can find opponents",
  completed: "Tournament completed",
};

export function useUpdateTournamentStatus() {
  return useTournamentMutation(
    ({ id, status }: { id: string; status: TournamentStatus }) =>
      api<TournamentDetail>(`/tournaments/${id}/status`, { method: "PATCH", json: { status } }),
    (v) => STATUS_TOAST[v.status],
  );
}

export function useDeleteTournament() {
  return useTournamentMutation(
    (id: string) => api<{ id: string; deleted: true }>(`/tournaments/${id}`, { method: "DELETE" }),
    () => "Tournament deleted",
  );
}

export function useJoinTournament() {
  return useTournamentMutation(
    (id: string) => api<TournamentDetail>(`/tournaments/${id}/join`, { method: "POST" }),
    () => "You're in! Good luck ♟",
  );
}

export function useLeaveTournament() {
  return useTournamentMutation(
    (id: string) => api<TournamentDetail>(`/tournaments/${id}/join`, { method: "DELETE" }),
    () => "You left the tournament",
  );
}
