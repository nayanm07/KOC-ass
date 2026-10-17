"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  ClientEvents,
  ServerEvents,
  type Ack,
  type MatchFound,
  type QueueStatus,
} from "@/lib/socket-events";

type ConnectionState = "connecting" | "connected" | "disconnected";

interface SocketContextValue {
  socket: Socket | null;
  connection: ConnectionState;
  queue: QueueStatus;
  /** Emit with an ack, resolving to the server's `{ success, data | error }` envelope */
  request: <T>(event: string, payload?: unknown, timeoutMs?: number) => Promise<Ack<T>>;
}

const SocketContext = createContext<SocketContextValue | null>(null);

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

/**
 * One Socket.IO connection per logged-in tab. The browser sends the httpOnly auth cookie in the
 * handshake (withCredentials). Global listeners live here so a "match found" push drops the player
 * into the game from any page.
 */
export function SocketProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [queue, setQueue] = useState<QueueStatus>({ waiting: false, tournamentId: null });

  useEffect(() => {
    const s = io(SOCKET_URL, { withCredentials: true, transports: ["websocket", "polling"] });
    setSocket(s);

    s.on("connect", () => setConnection("connected"));
    s.on("disconnect", () => setConnection("disconnected"));
    s.io.on("reconnect_attempt", () => setConnection("connecting"));
    s.on("connect_error", (err) => {
      setConnection("disconnected");
      if (err.message === "UNAUTHENTICATED") {
        s.disconnect();
        toast.error("Your session expired — please log in again.");
        router.replace("/login");
      }
    });

    s.on(ServerEvents.QueueStatus, (status: QueueStatus) => {
      setQueue(status);
      if (!status.waiting && status.reason === "tournament_closed") {
        toast.info("The tournament has ended — matchmaking stopped.");
      }
    });

    s.on(ServerEvents.MatchFound, (m: MatchFound) => {
      toast.success(`Opponent found: ${m.opponent.name}. You play ${m.color}!`);
      void qc.invalidateQueries({ queryKey: ["matches"] });
      router.push(`/match/${m.matchId}`);
    });

    // A game of mine finished: standings, histories and "current match" are now stale
    s.on(ServerEvents.MatchEnded, () => {
      void qc.invalidateQueries({ queryKey: ["matches"] });
      void qc.invalidateQueries({ queryKey: ["tournaments"] });
    });

    return () => {
      s.removeAllListeners();
      s.io.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
    // One connection per logged-in user; a different user gets a fresh socket
  }, [userId, router, qc]);

  const request = useCallback(
    <T,>(event: string, payload?: unknown, timeoutMs = 8000) =>
      new Promise<Ack<T>>((resolve) => {
        if (!socket?.connected) {
          resolve({ success: false, error: { code: "OFFLINE", message: "Not connected to the game server. Retrying…" } });
          return;
        }
        socket.timeout(timeoutMs).emit(event, payload ?? {}, (err: Error | null, ack: Ack<T>) => {
          resolve(err ? { success: false, error: { code: "TIMEOUT", message: "The server didn't respond. Try again." } } : ack);
        });
      }),
    [socket],
  );

  const value = useMemo(() => ({ socket, connection, queue, request }), [socket, connection, queue, request]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside <SocketProvider>");
  return ctx;
}

/** "Find opponent" state + actions for one tournament */
export function useMatchmaking(tournamentId: string) {
  const { queue, request, connection } = useSocket();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const waitingHere = queue.waiting && queue.tournamentId === tournamentId;

  const findOpponent = async () => {
    setPending(true);
    const ack = await request<QueueStatus>(ClientEvents.QueueJoin, { tournamentId });
    setPending(false);
    if (!ack.success) {
      const matchId = (ack.error.details as { matchId?: string } | undefined)?.matchId;
      if (ack.error.code === "ALREADY_IN_MATCH" && matchId) {
        toast.info("You're already in a game — taking you there.");
        router.push(`/match/${matchId}`);
        return;
      }
      toast.error(ack.error.message);
    }
  };

  const cancel = async () => {
    setPending(true);
    const ack = await request<QueueStatus>(ClientEvents.QueueLeave);
    setPending(false);
    if (!ack.success) toast.error(ack.error.message);
  };

  return {
    waiting: waitingHere,
    waitingElsewhere: queue.waiting && queue.tournamentId !== tournamentId,
    since: queue.waiting ? queue.since : null,
    pending,
    connected: connection === "connected",
    findOpponent,
    cancel,
  };
}
