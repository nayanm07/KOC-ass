"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Role, User } from "@/lib/types";

export const meQueryKey = ["me"] as const;

export const homeFor = (role: Role) => (role === "coach" ? "/coach" : "/student");

/** Current user, or null when logged out */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => {
      try {
        return (await api<{ user: User }>("/me")).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** `next` = page the user was bounced from; only honoured if it belongs to their role */
export function useLogin(next?: string | null) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<{ user: User }>("/auth/login", { method: "POST", json: input }),
    onSuccess: ({ user }) => {
      qc.setQueryData(meQueryKey, user);
      const home = homeFor(user.role);
      const target = next && (next.startsWith(home) || next.startsWith("/match")) ? next : home;
      router.replace(target);
      router.refresh();
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api<{ loggedOut: true }>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      // Drop every cached query so the next user never sees the previous user's data
      qc.clear();
      router.replace("/login");
      router.refresh();
    },
  });
}
