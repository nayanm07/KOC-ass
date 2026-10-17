"use client";

import { Loader2, Swords } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMatchmaking } from "@/components/socket-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentMatch } from "@/hooks/use-matches";
import type { TournamentDetail } from "@/lib/types";
import { JoinButton } from "./student-actions";

function useElapsed(since: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return "";
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Matchmaking({ tournamentId }: { tournamentId: string }) {
  const mm = useMatchmaking(tournamentId);
  const current = useCurrentMatch();
  const elapsed = useElapsed(mm.waiting ? mm.since : null);

  if (current.data?.matchId) {
    return (
      <Link href={`/match/${current.data.matchId}`} className={buttonVariants()}>
        Return to your game
      </Link>
    );
  }

  if (mm.waiting) {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin" /> Searching for an opponent… {elapsed}
        </span>
        <Button variant="outline" size="sm" disabled={mm.pending} onClick={mm.cancel}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button disabled={mm.pending || !mm.connected || current.isPending} onClick={mm.findOpponent}>
      {mm.pending ? "Joining queue…" : !mm.connected ? "Connecting…" : "Find opponent"}
    </Button>
  );
}

export function PlayPanel({ tournament: t }: { tournament: TournamentDetail }) {
  let message: string;
  if (!t.isJoined) {
    message = t.status === "open" ? "Join to take part." : "Registration for this tournament is closed.";
  } else if (t.status === "open") {
    message = "You're registered. Games start once the coach starts the tournament.";
  } else if (t.status === "ongoing") {
    message = "The tournament is live — you'll be paired with the next available player.";
  } else {
    message = "This tournament has finished.";
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Swords className="size-5 shrink-0 text-primary" />
          <p className="text-sm">{message}</p>
        </div>
        {t.isJoined && t.status === "ongoing" && <Matchmaking tournamentId={t.id} />}
        {!t.isJoined && t.status === "open" && <JoinButton tournament={t} size="default" />}
      </CardContent>
    </Card>
  );
}
