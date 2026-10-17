"use client";

import { useParams } from "next/navigation";
import { ErrorState, LoadingState } from "@/components/states";
import { CoachTournamentActions } from "@/components/tournaments/coach-actions";
import { LeaderboardCard, MatchResultsCard, TournamentStats, WinnerBanner } from "@/components/tournaments/leaderboard";
import { TournamentDetailView } from "@/components/tournaments/tournament-detail";
import { useTournament } from "@/hooks/use-tournaments";

export default function CoachTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const tournament = useTournament(id);

  if (tournament.isPending) return <LoadingState label="Loading tournament…" />;
  if (tournament.isError) return <ErrorState error={tournament.error} onRetry={() => tournament.refetch()} />;

  const t = tournament.data;
  const started = t.status === "ongoing" || t.status === "completed";
  return (
    <TournamentDetailView
      tournament={t}
      backHref="/coach"
      actions={<CoachTournamentActions tournament={t} redirectAfterDelete="/coach" />}
    >
      <WinnerBanner tournament={t} />
      {started && (
        <>
          <TournamentStats tournamentId={t.id} />
          <LeaderboardCard tournament={t} />
          {/* Coaches can watch any live game and review any finished one */}
          <MatchResultsCard
            tournamentId={t.id}
            canOpen={() => true}
            emptyHint="Players are paired automatically when they click “Find opponent”."
          />
        </>
      )}
    </TournamentDetailView>
  );
}
