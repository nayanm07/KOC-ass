"use client";

import { useParams } from "next/navigation";
import { ErrorState, LoadingState } from "@/components/states";
import { LeaderboardCard, MatchResultsCard, WinnerBanner } from "@/components/tournaments/leaderboard";
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
  const myId = me.data?.id;
  const started = t.status === "ongoing" || t.status === "completed";
  return (
    <TournamentDetailView
      tournament={t}
      backHref="/student"
      highlightUserId={myId}
      actions={t.isJoined && t.status === "open" ? <LeaveButton tournament={t} /> : undefined}
    >
      <WinnerBanner tournament={t} />
      <PlayPanel tournament={t} />
      {started && (
        <>
          <LeaderboardCard tournament={t} highlightUserId={myId} />
          {/* Students can open their own games (the API only lets players + coaches see a board) */}
          <MatchResultsCard
            tournamentId={t.id}
            canOpen={(w, b) => w === myId || b === myId}
            emptyHint="Click “Find opponent” to play the first game."
          />
        </>
      )}
    </TournamentDetailView>
  );
}
