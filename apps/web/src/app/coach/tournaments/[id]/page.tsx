"use client";

import { ArrowLeft, CalendarDays, Crown, Download, FileSpreadsheet, LayoutGrid, Timer, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, ErrorState, ListSkeleton, LoadingState } from "@/components/states";
import { CoachTournamentActions, MIN_PLAYERS } from "@/components/tournaments/coach-actions";
import { AnalysisCard, ChampionBanner, CrosstableCard, GameArchive, StatusSummary } from "@/components/tournaments/detail/final-panels";
import { GamesPanel, StandingsPanel, StandingsTable, StatCards } from "@/components/tournaments/detail/live-panels";
import { Panel, StatusPill, btn } from "@/components/tournaments/detail/primitives";
import { speedCategory } from "@/components/tournaments/tournament-form-dialog";
import { useLeaderboard, useTournament, useTournamentMatches } from "@/hooks/use-tournaments";
import { formatDateTime, fromNow } from "@/lib/format";
import type { TournamentDetail } from "@/lib/types";
import { buildPgnExport, buildStandingsCsv, downloadText, fileSlug } from "@/lib/tournament-stats";

function Header({ t, right }: { t: TournamentDetail; right: React.ReactNode }) {
  const minutes = t.timeControl.baseSeconds / 60;
  const when =
    t.status === "completed" && t.completedAt
      ? `Concluded ${formatDateTime(t.completedAt)}`
      : t.startedAt
        ? `Started ${formatDateTime(t.startedAt)}`
        : `Starts ${formatDateTime(t.startsAt)} (${fromNow(t.startsAt)})`;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">{t.name}</h1>
          <StatusPill status={t.status} />
        </div>
        {t.description && <p className="mt-1.5 max-w-2xl text-muted-foreground">{t.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {t.format === "round_robin" ? <LayoutGrid className="size-3.5" /> : <Crown className="size-3.5" />}
            {t.format === "round_robin" ? "Round robin" : "Arena"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-brand-orange">
            <Timer className="size-3.5" />
            {t.timeControl.label} {speedCategory(minutes, t.timeControl.incrementSeconds)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {when}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            {t.participantCount} {t.participantCount === 1 ? "player" : "players"}
          </span>
        </div>
      </div>
      {right}
    </div>
  );
}

/** Before the start: who has joined + whether it can start */
function RegistrationView({ t }: { t: TournamentDetail }) {
  const ready = t.participantCount >= MIN_PLAYERS;
  return (
    <Panel
      eyebrow={t.status === "draft" ? "Draft" : "Registration"}
      title={`Players (${t.participants.length})`}
      subtitle={
        t.status === "draft"
          ? "Unpublished — students can’t see it until you open registration."
          : ready
            ? "Ready to start — players can find opponents as soon as you start it."
            : `${MIN_PLAYERS - t.participantCount} more player${MIN_PLAYERS - t.participantCount === 1 ? "" : "s"} needed to start.`
      }
    >
      {t.participants.length === 0 ? (
        <EmptyState title="No players yet" description={t.status === "open" ? "Students can join from their Tournaments page." : "Open registration to let students join."} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {t.participants.map((p, i) => (
            <li key={p.userId} className="flex items-center justify-between rounded-xl bg-[#f6f2ea] px-4 py-3">
              <span className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                <span className="font-medium text-primary">{p.name}</span>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(p.joinedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function CoachTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const tournament = useTournament(id);
  const started = tournament.data?.status === "ongoing" || tournament.data?.status === "completed";
  const lb = useLeaderboard(id, started);
  const games = useTournamentMatches(id);

  if (tournament.isPending) return <LoadingState label="Loading tournament…" />;
  if (tournament.isError) return <ErrorState error={tournament.error} onRetry={() => tournament.refetch()} />;

  const t = tournament.data;
  const completed = t.status === "completed";
  const matches = games.data ?? [];
  const pgn = buildPgnExport(matches);

  const exportsBar = completed && lb.data && (
    <div className="flex flex-wrap gap-2">
      {pgn && (
        <button type="button" className={btn.soft} onClick={() => downloadText(`${fileSlug(t.name)}.pgn`, pgn, "application/x-chess-pgn")}>
          <Download className="size-4" /> Download PGNs
        </button>
      )}
      <button
        type="button"
        className={btn.soft}
        onClick={() => downloadText(`${fileSlug(t.name)}-standings.csv`, buildStandingsCsv(lb.data!.standings), "text/csv")}
      >
        <FileSpreadsheet className="size-4" /> Export standings
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <Link href="/coach" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" /> All tournaments
      </Link>

      <Header t={t} right={completed ? exportsBar : <CoachTournamentActions tournament={t} redirectAfterDelete="/coach" />} />

      {!started && <RegistrationView t={t} />}

      {started &&
        (lb.isPending || games.isPending ? (
          <ListSkeleton rows={3} />
        ) : lb.isError ? (
          <ErrorState error={lb.error} onRetry={() => lb.refetch()} />
        ) : games.isError ? (
          <ErrorState error={games.error} onRetry={() => games.refetch()} />
        ) : completed ? (
          <>
            <ChampionBanner tournament={t} lb={lb.data} />
            <StatusSummary tournament={t} lb={lb.data} matches={matches} />
            {t.format === "round_robin" && <CrosstableCard standings={lb.data.standings} matches={matches} completed />}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Panel eyebrow="Standings" title="Final rank summary" subtitle="Tiebreaks: 1. Sonneborn-Berger · 2. wins · 3. head-to-head">
                <StandingsTable rows={lb.data.standings} winnerId={lb.data.winner?.userId} />
              </Panel>
              <AnalysisCard lb={lb.data} matches={matches} />
            </div>
            <GameArchive matches={matches} />
          </>
        ) : (
          <>
            <StatCards lb={lb.data} matches={matches} />
            {t.format === "round_robin" && <StatusSummary tournament={t} lb={lb.data} matches={matches} />}
            {/* Stacked full-width so no standings / games column is ever cut off */}
            <StandingsPanel tournament={t} lb={lb.data} />
            {/* Coaches can watch any live game and review any finished one */}
            <GamesPanel tournament={t} matches={matches} canOpen={() => true} />
            {t.format === "round_robin" && <CrosstableCard standings={lb.data.standings} matches={matches} completed={false} />}
          </>
        ))}
    </div>
  );
}
