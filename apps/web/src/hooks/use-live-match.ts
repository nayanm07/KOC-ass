"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Chess, type Square } from "chess.js";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSocket } from "@/components/socket-provider";
import { matchKeys, useMatch } from "@/hooks/use-matches";
import { ClientEvents, ServerEvents, type MatchEnded } from "@/lib/socket-events";
import type { Color, MatchView } from "@/lib/types";

export interface LiveState {
  /** Latest authoritative state from the server */
  match: MatchView;
  /** Local time when `match.clock` was received — clocks tick from here */
  receivedAt: number;
}

export type Promotion = "q" | "r" | "b" | "n";

/**
 * Live match state. The server is the source of truth:
 *  - initial state via REST, then `match:join` (re-sent on every reconnect) to subscribe + resync
 *  - every `match:state` broadcast replaces local state
 *  - our own moves are applied optimistically and confirmed (or rolled back) by the ack
 */
export function useLiveMatch(matchId: string) {
  const { socket, connection, request } = useSocket();
  const qc = useQueryClient();
  const initial = useMatch(matchId);

  const [live, setLive] = useState<LiveState | null>(null);
  const [optimisticFen, setOptimisticFen] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ended, setEnded] = useState<MatchEnded | null>(null);
  const [yourColor, setYourColor] = useState<Color | null>(null);

  const accept = useCallback((m: MatchView) => {
    // Broadcasts carry yourColor = null; keep the one from our own join/REST response
    if (m.yourColor) setYourColor(m.yourColor);
    setLive((prev) => (prev && prev.match.ply > m.ply && m.status === "ongoing" ? prev : { match: m, receivedAt: Date.now() }));
    setOptimisticFen(null);
  }, []);

  // 1) First paint from REST
  useEffect(() => {
    if (initial.data && !live) accept(initial.data);
  }, [initial.data, live, accept]);

  // 2) Subscribe to the room on every (re)connect and resync from the ack
  useEffect(() => {
    if (!socket || connection !== "connected") return;
    let cancelled = false;
    void request<MatchView>(ClientEvents.MatchJoin, { matchId }).then((ack) => {
      if (cancelled) return;
      if (ack.success) accept(ack.data);
      else toast.error(ack.error.message);
    });
    return () => {
      cancelled = true;
      if (socket.connected) socket.emit(ClientEvents.MatchLeave, { matchId });
    };
  }, [socket, connection, matchId, request, accept]);

  // 3) Live updates
  useEffect(() => {
    if (!socket) return;
    const onState = (m: MatchView) => m.id === matchId && accept(m);
    const onEnded = (e: MatchEnded) => {
      if (e.matchId !== matchId) return;
      setEnded(e);
      void qc.invalidateQueries({ queryKey: matchKeys.all });
    };
    socket.on(ServerEvents.MatchState, onState);
    socket.on(ServerEvents.MatchEnded, onEnded);
    return () => {
      socket.off(ServerEvents.MatchState, onState);
      socket.off(ServerEvents.MatchEnded, onEnded);
    };
  }, [socket, matchId, accept, qc]);

  const match = live?.match ?? null;
  const myColor = yourColor ?? match?.yourColor ?? null;
  const isMyTurn = !!match && match.status === "ongoing" && match.turn === myColor && !pending;

  /** Resync after a rejected move (e.g. STALE_STATE) */
  const resync = useCallback(async () => {
    const ack = await request<MatchView>(ClientEvents.MatchJoin, { matchId });
    if (ack.success) accept(ack.data);
  }, [request, matchId, accept]);

  /** Validate locally for instant feedback, show it optimistically, then let the server decide */
  const move = useCallback(
    (from: string, to: string, promotion?: Promotion): boolean => {
      if (!match || !isMyTurn) return false;
      const local = new Chess(match.fen);
      try {
        local.move({ from: from as Square, to: to as Square, promotion });
      } catch {
        return false; // illegal — the board snaps the piece back
      }
      setOptimisticFen(local.fen());
      setPending(true);
      void request<{ ply: number }>(ClientEvents.MatchMove, {
        matchId,
        from,
        to,
        ...(promotion && { promotion }),
        ply: match.ply,
      }).then((ack) => {
        setPending(false);
        if (!ack.success) {
          setOptimisticFen(null);
          toast.error(ack.error.message);
          void resync();
        }
      });
      return true;
    },
    [match, isMyTurn, request, matchId, resync],
  );

  const act = useCallback(
    async (event: string, payload: Record<string, unknown> = {}) => {
      const ack = await request(event, { matchId, ...payload });
      if (!ack.success) toast.error(ack.error.message);
      return ack.success;
    },
    [request, matchId],
  );

  return {
    initial,
    match,
    receivedAt: live?.receivedAt ?? Date.now(),
    displayFen: optimisticFen ?? match?.fen ?? null,
    myColor,
    isMyTurn,
    pending,
    connected: connection === "connected",
    ended,
    dismissEnded: () => setEnded(null),
    move,
    resign: () => act(ClientEvents.MatchResign),
    offerDraw: () => act(ClientEvents.MatchOfferDraw),
    respondDraw: (accept: boolean) => act(ClientEvents.MatchRespondDraw, { accept }),
  };
}
