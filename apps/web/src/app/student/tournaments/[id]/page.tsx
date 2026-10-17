"use client";

import { useParams } from "next/navigation";
import { ErrorState, LoadingState } from "@/components/states";
import { PlayPanel } from "@/components/tournaments/play-panel";
import { LeaveButton } from "@/components/tournaments/student-actions";
import { TournamentDetailView } from "@/components/tournaments/tournament-detail";
import { useMe } from "@/hooks/use-auth";
import { useTournament } from "@/hooks/use-tournaments";

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
