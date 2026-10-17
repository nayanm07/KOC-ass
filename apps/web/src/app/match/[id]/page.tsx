"use client";

import { useParams } from "next/navigation";
import { ErrorState, LoadingState } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMatch } from "@/hooks/use-matches";

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const match = useMatch(id);

  if (match.isPending) return <LoadingState label="Loading game…" />;
  if (match.isError) return <ErrorState error={match.error} onRetry={() => match.refetch()} />;

  const m = match.data;
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>
          {m.white.name} (white) vs {m.black.name} (black)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          {m.tournament.name} · {m.timeControl.label}
          {m.yourColor && <> · You play {m.yourColor}</>}
        </p>
        <p>The live board is being wired up next.</p>
      </CardContent>
    </Card>
  );
}
