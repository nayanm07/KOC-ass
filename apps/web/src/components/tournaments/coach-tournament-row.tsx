"use client";

import {
  ArrowRight,
  CalendarDays,
  Crown,
  Eye,
  LayoutGrid,
  Pencil,
  PlayCircle,
  Radio,
  Timer,
  Trash2,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useDeleteTournament, useLeaderboard, useUpdateTournamentStatus } from "@/hooks/use-tournaments";
import { formatDateTime, fromNow } from "@/lib/format";
import type { Tournament, TournamentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatPoints } from "./leaderboard";
import { TournamentFormDialog } from "./tournament-form-dialog";

const ACCENT: Record<TournamentStatus, string> = {
  ongoing: "before:bg-emerald-500",
  open: "before:bg-sky-500",
  draft: "before:bg-slate-300",
  completed: "before:bg-amber-400",
};

const PILL: Record<TournamentStatus, { label: string; cls: string }> = {
  ongoing: { label: "Live", cls: "bg-emerald-50 text-emerald-700" },
  open: { label: "Registration open", cls: "bg-sky-50 text-sky-700" },
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
  completed: { label: "Completed", cls: "bg-amber-50 text-amber-800" },
};

/** Players needed before a tournament can start (mirrors the API rule) */
const MIN_PLAYERS = 2;

const btn = {
  primary:
    "inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60",
  orange:
    "inline-flex h-10 items-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-50",
  soft: "inline-flex h-10 items-center gap-2 rounded-xl bg-[#f1ece2] px-4 text-sm font-medium text-primary transition hover:bg-[#e9e2d5] disabled:opacity-60",
  danger:
    "inline-flex h-10 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60",
  icon: "inline-flex size-10 items-center justify-center rounded-xl bg-[#f1ece2] text-primary transition hover:bg-[#e9e2d5]",
};

/** One real-data line under the meta row: live games + leader, RR progress, readiness, or winner */
function Insight({ t }: { t: Tournament }) {
  const needsStats = t.status === "ongoing" || t.status === "completed";
  const lb = useLeaderboard(t.id, needsStats);
  const data = needsStats ? lb.data : undefined;

  if (t.status === "draft") {
    return <p className="text-xs text-muted-foreground">Unpublished — students can’t see it until you open registration.</p>;
  }

  if (t.status === "open") {
    const ready = t.participantCount >= MIN_PLAYERS;
    const pct = Math.min(100, (t.participantCount / MIN_PLAYERS) * 100);
    return (
      <div className="space-y-1.5">
        <p className={cn("flex items-center gap-1.5 text-xs font-medium", ready ? "text-emerald-700" : "text-brand-orange")}>
          <Users className="size-3.5" />
          {ready
            ? `${t.participantCount} players registered — ready to start`
            : `${MIN_PLAYERS - t.participantCount} more player${MIN_PLAYERS - t.participantCount === 1 ? "" : "s"} needed to start`}
        </p>
        <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-[#ece6da]">
          <div
            className={cn("h-full rounded-full transition-all", ready ? "bg-emerald-500" : "bg-brand-orange")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (!data) return <p className="h-4 w-56 animate-pulse rounded bg-muted" aria-hidden />;

  if (t.status === "completed") {
    const w = data.standings.find((r) => r.userId === t.winner?.id);
    return t.winner ? (
      <p className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-brand-orange">
        <Trophy className="size-3.5" />
        Winner: {t.winner.name}
        {w && ` · ${formatPoints(w.points)} pt${w.points === 1 ? "" : "s"} from ${w.played} game${w.played === 1 ? "" : "s"}`}
      </p>
    ) : (
      <p className="text-xs text-muted-foreground">Finished — first place shared. See the final standings.</p>
    );
  }

  // ongoing
  const parts: string[] = [];
  if (data.roundRobin) parts.push(`Round robin: ${data.roundRobin.completedGames} / ${data.roundRobin.totalGames} games played`);
  if (data.stats.liveGames > 0 || !data.roundRobin) {
    parts.push(`${data.stats.liveGames} game${data.stats.liveGames === 1 ? "" : "s"} live`);
  }
  const leaderRow = data.leader && data.standings.find((r) => r.userId === data.leader?.userId);
  if (leaderRow) parts.push(`${leaderRow.name} leading (${formatPoints(leaderRow.points)} pts)`);
  else if (data.stats.gamesPlayed === 0) parts.push("no results yet");
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-brand-orange">
      <Radio className="size-3.5" />
      {parts.join(" · ")}
    </p>
  );
}

export function CoachTournamentRow({ tournament: t }: { tournament: Tournament }) {
  const setStatus = useUpdateTournamentStatus();
  const del = useDeleteTournament();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<null | "ongoing" | "completed" | "delete">(null);

  const href = `/coach/tournaments/${t.id}`;
  const roundRobin = t.format === "round_robin";
  const pill = PILL[t.status];
  const canStart = t.participantCount >= MIN_PLAYERS;

  const go = (to: TournamentStatus) => setStatus.mutate({ id: t.id, status: to }, { onSettled: () => setConfirm(null) });

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-5 pl-7 shadow-sm transition-shadow before:absolute before:inset-y-0 before:left-0 before:w-1.5 hover:shadow-md sm:p-6 sm:pl-8",
        ACCENT[t.status],
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href={href} className="truncate text-xl font-bold tracking-tight text-primary hover:underline">
              {t.name}
            </Link>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-medium", pill.cls)}>
              {t.status === "completed" ? <Trophy className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
              {pill.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {roundRobin ? <LayoutGrid className="size-4" /> : <Crown className="size-4" />}
              {roundRobin ? "Round robin" : "Arena"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Timer className="size-4" />
              <span className="rounded-md bg-[#f1ece2] px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                {t.timeControl.label}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs">
              <CalendarDays className="size-4" />
              {formatDateTime(t.startsAt)}
              {t.status !== "completed" && <span>({fromNow(t.startsAt)})</span>}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" />
              {t.participantCount} {t.participantCount === 1 ? "player" : "players"}
            </span>
          </div>

          <Insight t={t} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {t.status === "draft" && (
            <>
              <button type="button" className={btn.icon} aria-label="Delete tournament" title="Delete" onClick={() => setConfirm("delete")}>
                <Trash2 className="size-4" />
              </button>
              <button type="button" className={btn.soft} onClick={() => setEditing(true)}>
                Edit
              </button>
              <button type="button" className={btn.primary} disabled={setStatus.isPending} onClick={() => go("open")}>
                <Upload className="size-4" /> Open registration
              </button>
            </>
          )}

          {t.status === "open" && (
            <>
              {t.participantCount === 0 ? (
                <button type="button" className={btn.soft} disabled={setStatus.isPending} onClick={() => go("draft")}>
                  Back to draft
                </button>
              ) : (
                <button type="button" className={btn.icon} aria-label="Delete tournament" title="Delete" onClick={() => setConfirm("delete")}>
                  <Trash2 className="size-4" />
                </button>
              )}
              <button type="button" className={btn.icon} aria-label="Edit tournament" title="Edit" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                className={btn.orange}
                disabled={!canStart || setStatus.isPending}
                title={canStart ? undefined : `At least ${MIN_PLAYERS} players are needed to start`}
                onClick={() => setConfirm("ongoing")}
              >
                <PlayCircle className="size-4" /> Start tournament
              </button>
            </>
          )}

          {t.status === "ongoing" && (
            <>
              <button type="button" className={btn.danger} disabled={setStatus.isPending} onClick={() => setConfirm("completed")}>
                Complete tournament
              </button>
              <button type="button" className={btn.icon} aria-label="Edit tournament" title="Edit name / description" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
              </button>
              <Link href={href} className={btn.primary}>
                {roundRobin ? (
                  <>
                    <LayoutGrid className="size-4" /> View crosstable
                  </>
                ) : (
                  <>
                    Monitor live <ArrowRight className="size-4" />
                  </>
                )}
              </Link>
            </>
          )}

          {t.status === "completed" && (
            <Link href={href} className={btn.soft}>
              <Eye className="size-4" /> View standings
            </Link>
          )}
        </div>
      </div>

      {editing && <TournamentFormDialog open onOpenChange={setEditing} tournament={t} />}

      <ConfirmDialog
        open={confirm === "ongoing"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Start “${t.name}”?`}
        description="Registration closes and players can start finding opponents. Format, time control and start time become locked."
        confirmLabel="Start tournament"
        pending={setStatus.isPending}
        onConfirm={() => go("ongoing")}
      />
      <ConfirmDialog
        open={confirm === "completed"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Complete “${t.name}”?`}
        description="No more games can be played and the winner is declared from the final standings. This cannot be undone."
        confirmLabel="Complete tournament"
        pending={setStatus.isPending}
        onConfirm={() => go("completed")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete “${t.name}”?`}
        description="This removes the tournament and its participant list. This cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={del.isPending}
        onConfirm={() => del.mutate(t.id, { onSuccess: () => setConfirm(null) })}
      />
    </article>
  );
}
