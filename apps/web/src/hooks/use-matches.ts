"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MatchView, MyMatchRow } from "@/lib/types";

export const matchKeys = {
  all: ["matches"] as const,
  current: () => [...matchKeys.all, "current"] as const,
  mine: () => [...matchKeys.all, "mine"] as const,
  detail: (id: string) => [...matchKeys.all, "detail", id] as const,
};

/** My in-progress game, if any — lets a player get back to it after a refresh */
export function useCurrentMatch(enabled = true) {
  return useQuery({
    queryKey: matchKeys.current(),
    queryFn: () => api<{ matchId: string | null }>("/matches/current"),
    enabled,
    staleTime: 0,
  });
}

export function useMyMatches() {
  return useQuery({
    queryKey: matchKeys.mine(),
    queryFn: () => api<MyMatchRow[]>("/matches"),
  });
}

export function useMatch(id: string) {
  return useQuery({
    queryKey: matchKeys.detail(id),
    queryFn: () => api<MatchView>(`/matches/${id}`),
    staleTime: 0,
  });
}
