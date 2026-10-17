"use client";

import { Swords } from "lucide-react";
import { useParams } from "next/navigation";
import { ErrorState, LoadingState } from "@/components/states";
import { JoinButton, LeaveButton } from "@/components/tournaments/student-actions";
import { TournamentDetailView } from "@/components/tournaments/tournament-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMe } from "@/hooks/use-auth";
import { useTournament } from "@/hooks/use-tournaments";
import type { TournamentDetail } from "@/lib/types";

function PlayPanel({ tournament: t }: { tournament: TournamentDetail }) {
  let message: string;
  if (!t.isJoined) {
    message = t.status === "open" ? "Join to take part." : "Registration for this tournament is closed.";
  } else if (t.status === "open") {
    message = "You're registered. Games start once the coach starts the tournament.";
  } else if (t.status === "ongoing") {
    message = "The tournament is live — find an opponent to play your next game.";
  } else {
    message = "This tournament has finished.";
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Swords className="size-5 text-primary" />
          <p className="text-sm">{message}</p>
        </div>
        {t.isJoined && t.status === "ongoing" && (
          <Button disabled title="Matchmaking arrives in the next step">
            Find opponent
          </Button>
        )}
        {!t.isJoined && t.status === "open" && <JoinButton tournament={t} size="default" />}
      </CardContent>
    </Card>
  );
}

export default function StudentTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const tournament = useTournament(id);
  const me = useMe();

  if (tournament.isPending) return <LoadingState label="Loading tournament…" />;
  if (tournament.isError) return <ErrorState error={tournament.error} onRetry={() => tournament.refetch()} />;

  const t = tournament.data;
  return (
    <TournamentDetailView
      tournament={t}
      backHref="/student"
      highlightUserId={me.data?.id}
      actions={t.isJoined && t.status === "open" ? <LeaveButton tournament={t} /> : undefined}
    >
      <PlayPanel tournament={t} />
    </TournamentDetailView>
  );
}
