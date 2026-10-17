"use client";

import { useParams } from "next/navigation";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { CoachTournamentActions } from "@/components/tournaments/coach-actions";
import { TournamentDetailView } from "@/components/tournaments/tournament-detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTournament } from "@/hooks/use-tournaments";

export default function CoachTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const tournament = useTournament(id);

  if (tournament.isPending) return <LoadingState label="Loading tournament…" />;
  if (tournament.isError) return <ErrorState error={tournament.error} onRetry={() => tournament.refetch()} />;

  const t = tournament.data;
  return (
    <TournamentDetailView
      tournament={t}
      backHref="/coach"
      actions={<CoachTournamentActions tournament={t} redirectAfterDelete="/coach" />}
    >
      <Card>
        <CardHeader>
          <CardTitle>Standings &amp; results</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No games played yet"
            description={
              t.status === "ongoing"
                ? "Players are being paired automatically — results will appear here."
                : "Start the tournament to let players find opponents."
            }
          />
        </CardContent>
      </Card>
    </TournamentDetailView>
  );
}
