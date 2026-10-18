"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, ErrorState, ListSkeleton, LoadingState } from "@/components/states";
import { ChampionBanner, CrosstableCard } from "@/components/tournaments/detail/final-panels";
import { GamesPanel, StandingsPanel } from "@/components/tournaments/detail/live-panels";
import { Panel } from "@/components/tournaments/detail/primitives";
import {
  FormatNotice,
  MatchmakingHero,
  MyProgressCard,
  myTournamentGames,
  StudentTournamentHeader,
} from "@/components/tournaments/student/student-detail";
import { useMe } from "@/hooks/use-auth";
import { useMyMatches } from "@/hooks/use-matches";
import { useLeaderboard, useTournament, useTournamentMatches } from "@/hooks/use-tournaments";
import { formatDateTime } from "@/lib/format";

export default function StudentTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const tournament = useTournament(id);
  const me = useMe();
  const started = tournament.data?.status === "ongoing" || tournament.data?.status === "completed";
  const lb = useLeaderboard(id, started);
  const games = useTournamentMatches(id);
  const mine = useMyMatches();

  if (tournament.isPending) return <LoadingState label="Loading tournament…" />;
  if (tournament.isError) return <ErrorState error={tournament.error} onRetry={() => tournament.refetch()} />;

  const t = tournament.data;
  const myId = me.data?.id;
  const { finished, live, streak } = myTournamentGames(mine.data, t.id);
  const myRow = lb.data?.standings.find((r) => r.userId === myId);
  const playedEveryone =
    t.format === "round_robin" && !!myRow && !!lb.data && myRow.played >= lb.data.standings.length - 1;

  return (
    <div className="space-y-6">
      <Link href="/student" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" /> Back to tournaments
      </Link>

      <StudentTournamentHeader t={t} lb={lb.data} meId={myId} streak={streak} />

      {t.status === "completed" && lb.data && <ChampionBanner tournament={t} lb={lb.data} />}

      <MatchmakingHero t={t} liveMatchId={live?.id ?? null} playedEveryone={playedEveryone} />

      {!started ? (
        <Panel title={`Players (${t.participants.length})`} subtitle="Everyone registered so far">
          {t.participants.length === 0 ? (
            <EmptyState title="No players yet" description="Be the first to join!" />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {t.participants.map((p, i) => (
                <li
                  key={p.userId}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 ${p.userId === myId ? "bg-orange-50" : "bg-[#f6f2ea]"}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                    <span className="font-medium text-primary">
                      {p.name}
                      {p.userId === myId && <span className="ml-1.5 text-xs text-brand-orange">(you)</span>}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(p.joinedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : lb.isPending || games.isPending ? (
        <ListSkeleton rows={3} />
      ) : lb.isError ? (
        <ErrorState error={lb.error} onRetry={() => lb.refetch()} />
      ) : games.isError ? (
        <ErrorState error={games.error} onRetry={() => games.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-7">
              <StandingsPanel tournament={t} lb={lb.data} highlightUserId={myId} />
            </div>
            <div className="min-w-0 space-y-4 lg:col-span-5">
              {t.isJoined && <MyProgressCard finished={finished} live={live} />}
              <FormatNotice t={t} />
            </div>
          </div>
          {t.format === "round_robin" && (
            <div id="crosstable" className="scroll-mt-24">
              <CrosstableCard
                standings={lb.data.standings}
                matches={games.data}
                completed={t.status === "completed"}
                highlightUserId={myId}
              />
            </div>
          )}
          <GamesPanel
            tournament={t}
            matches={games.data}
            viewerId={myId}
            canOpen={(m) => m.white.id === myId || m.black.id === myId}
          />
        </>
      )}
    </div>
  );
}
