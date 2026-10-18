"use client";

import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Crown,
  Flame,
  LayoutGrid,
  Swords,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useMatchmaking } from "@/components/socket-provider";
import { MIN_PLAYERS } from "@/components/tournaments/coach-actions";
import { formatPoints, MEDAL } from "@/components/tournaments/detail/primitives";
import { speedCategory } from "@/components/tournaments/tournament-form-dialog";
import { useMyMatches } from "@/hooks/use-matches";
import { useJoinTournament, useLeaderboard, useLeaveTournament } from "@/hooks/use-tournaments";
import { formatDate, formatDateTime, fromNow } from "@/lib/format";
import type { Tournament } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ───────────────────────── Shared bits ───────────────────────── */

export const cardCls = "relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6";

const btn = {
  primary:
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60",
  soft: "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#f1ece2] px-4 text-sm font-medium text-primary transition hover:bg-[#e9e2d5]",
  ghost: "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition hover:text-primary",
};

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", className)}>{children}</span>;
}

const tcLabel = (t: Tournament) =>
  `${t.timeControl.label} ${speedCategory(t.timeControl.baseSeconds / 60, t.timeControl.incrementSeconds)}`;

function FormatLabel({ t }: { t: Tournament }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-primary">
      {t.format === "round_robin" ? <LayoutGrid className="size-4 text-brand-orange" /> : <Swords className="size-4 text-brand-orange" />}
      {t.format === "round_robin" ? "Round robin" : "Arena"}
    </span>
  );
}

/** Re-renders every `ms` so countdowns stay current */
function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** "2d 4h" / "3h 12m" / "8m" until the start; null once the start time has passed */
export function countdown(iso: string, now: number): string | null {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return null;
  const m = Math.floor(diff / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

/** My games in one tournament: current win streak + my live game there (if any) */
function useMyTournamentGames(tournamentId: string): { streak: number; liveMatchId: string | null } {
  const mine = useMyMatches();
  const games = (mine.data ?? [])
    .filter((m) => m.tournament.id === tournamentId)
    .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));
  let streak = 0;
  for (const g of games.filter((x) => x.outcome)) {
    if (g.outcome !== "win") break;
    streak++;
  }
  return { streak, liveMatchId: games.find((g) => g.status === "ongoing")?.id ?? null };
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/* ───────────────────────── Join / leave ───────────────────────── */

function JoinBtn({ t, className }: { t: Tournament; className?: string }) {
  const join = useJoinTournament();
  return (
    <button type="button" className={cn(btn.primary, className)} disabled={join.isPending} onClick={() => join.mutate(t.id)}>
      <Trophy className="size-4" /> {join.isPending ? "Joining…" : "Join tournament"}
    </button>
  );
}

function LeaveBtn({ t }: { t: Tournament }) {
  const leave = useLeaveTournament();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button type="button" className="px-2 py-1 text-sm font-medium text-red-600/80 hover:text-red-700 hover:underline" onClick={() => setConfirm(true)}>
        Withdraw entry
      </button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Withdraw from “${t.name}”?`}
        description="You can join again while registration is still open."
        confirmLabel="Withdraw"
        destructive
        pending={leave.isPending}
        onConfirm={() => leave.mutate(t.id, { onSuccess: () => setConfirm(false) })}
      />
    </>
  );
}

/** "Play" straight from a card: joins the matchmaking queue; match:found redirects into the game */
function PlayButton({ t, roundRobinDone }: { t: Tournament; roundRobinDone: boolean }) {
  const mm = useMatchmaking(t.id);
  if (roundRobinDone) {
    return <p className="rounded-xl bg-emerald-50 px-3 py-3 text-center text-sm font-semibold text-emerald-800">✓ You’ve played everyone</p>;
  }
  if (mm.waiting) {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary/10 text-sm font-semibold text-primary">
          <span className="size-2 animate-ping rounded-full bg-brand-orange" /> Searching for an opponent…
        </p>
        <button type="button" className={btn.ghost} disabled={mm.pending} onClick={mm.cancel}>
          Cancel search
        </button>
      </div>
    );
  }
  return (
    <button type="button" className={cn(btn.primary, "h-12 text-base")} disabled={mm.pending || !mm.connected} onClick={mm.findOpponent}>
      {mm.pending ? "Joining queue…" : !mm.connected ? "Connecting…" : "Play"} <ArrowRight className="size-4" />
    </button>
  );
}

/* ───────────────────────── Browse: live ───────────────────────── */

function SpecTile({ icon: Icon, label, value, mono }: { icon: typeof Timer; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-[#f6f2ea] px-3 py-2.5">
      <Icon className="size-4.5 shrink-0 text-brand-orange" />
      <div className="min-w-0">
        <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{label}</p>
        <p className={cn("truncate text-sm font-semibold text-primary", mono && "font-mono")}>{value}</p>
      </div>
    </div>
  );
}

export function LiveCard({ t, meId }: { t: Tournament; meId?: string }) {
  const lb = useLeaderboard(t.id, t.isJoined);
  const { streak, liveMatchId } = useMyTournamentGames(t.id);
  const me = lb.data?.standings.find((r) => r.userId === meId);
  const href = `/student/tournaments/${t.id}`;
  const inGameHere = !!liveMatchId;

  return (
    <article className={cn(cardCls, "flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between")}>
      <div className="flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill className="bg-emerald-50 font-mono text-emerald-700">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> LIVE
          </Pill>
          {t.isJoined ? (
            <Pill className="bg-emerald-100 text-emerald-900">
              <CheckCircle2 className="size-3.5" /> Joined
            </Pill>
          ) : (
            <Pill className="bg-[#f1ece2] text-muted-foreground">Registration closed</Pill>
          )}
          {me && me.played > 0 && (
            <Pill className="bg-amber-100 text-amber-900">
              👑 Your rank: #{me.rank} ({formatPoints(me.points)} pt{me.points === 1 ? "" : "s"})
            </Pill>
          )}
          {streak >= 2 && (
            <Pill className="bg-orange-50 text-brand-orange">
              <Flame className="size-3.5" /> {streak}-win streak
            </Pill>
          )}
        </div>
        <div>
          <Link href={href} className="text-2xl font-bold tracking-tight text-primary hover:underline">
            {t.name}
          </Link>
          {t.description && <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <SpecTile icon={t.format === "round_robin" ? LayoutGrid : Swords} label="Format" value={t.format === "round_robin" ? "Round robin" : "Arena"} />
          <SpecTile icon={Timer} label="Clock" value={tcLabel(t)} mono />
          <SpecTile icon={CalendarDays} label="Started" value={t.startedAt ? formatDateTime(t.startedAt).split(", ")[1] : "—"} mono />
          <SpecTile icon={Users} label="Players" value={`${t.participantCount} playing`} />
        </div>
      </div>

      {t.isJoined ? (
        <div className="flex min-w-[220px] flex-col gap-2.5">
          <p
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-center text-xs font-semibold",
              inGameHere ? "animate-pulse bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800",
            )}
          >
            <Zap className="size-3.5" />
            {inGameHere ? "You’re in a game — jump back in!" : "Ready to find an opponent"}
          </p>
          {inGameHere ? (
            <Link href={`/match/${liveMatchId}`} className={cn(btn.primary, "h-12 text-base")}>
              Resume game <ArrowRight className="size-4" />
            </Link>
          ) : (
            <PlayButton
              t={t}
              roundRobinDone={t.format === "round_robin" && !!me && !!lb.data && me.played >= lb.data.standings.length - 1}
            />
          )}
          <Link href={href} className={btn.soft}>
            <BarChart3 className="size-4" /> View standings
          </Link>
        </div>
      ) : (
        <div className="flex min-w-[200px] flex-col gap-2">
          <Link href={href} className={btn.soft}>
            <BarChart3 className="size-4" /> View standings
          </Link>
        </div>
      )}
    </article>
  );
}

/* ───────────────────────── Browse: open ───────────────────────── */

export function OpenCard({ t }: { t: Tournament }) {
  const now = useNow();
  const ready = t.participantCount >= MIN_PLAYERS;
  const pct = Math.min(100, (t.participantCount / MIN_PLAYERS) * 100);
  return (
    <article className={cn(cardCls, "flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between")}>
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill className="bg-sky-50 font-mono text-sky-700">
            <span className="size-1.5 rounded-full bg-sky-500" /> Registration open
          </Pill>
          {t.isJoined && (
            <Pill className="bg-emerald-100 text-emerald-900">
              <CheckCircle2 className="size-3.5" /> You’re registered
            </Pill>
          )}
        </div>
        <Link href={`/student/tournaments/${t.id}`} className="block text-xl font-bold tracking-tight text-primary hover:underline">
          {t.name}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <FormatLabel t={t} />
          <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-primary">
            <Timer className="size-4 text-brand-orange" /> {tcLabel(t)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            {formatDateTime(t.startsAt)}
            <span className="font-medium text-brand-orange">({fromNow(t.startsAt)})</span>
          </span>
        </div>
        <div className="max-w-md space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-primary">
              {t.participantCount} player{t.participantCount === 1 ? "" : "s"} joined
            </span>
            <span className={cn("font-mono", ready ? "text-emerald-700" : "text-brand-orange")}>
              {ready ? "Ready to start" : `Needs ${MIN_PLAYERS - t.participantCount} more to start`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#ece6da]">
            <div className={cn("h-full rounded-full", ready ? "bg-emerald-500" : "bg-brand-orange")} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="flex min-w-[210px] flex-col items-stretch gap-2">
        {t.isJoined ? (
          <>
            <Link href={`/student/tournaments/${t.id}`} className={btn.soft}>
              Tournament page <ArrowRight className="size-4" />
            </Link>
            <p className="text-center font-mono text-[11px] text-muted-foreground">
              {countdown(t.startsAt, now) ? `Starts in ${countdown(t.startsAt, now)}` : "Waiting for the coach to start"}
            </p>
          </>
        ) : (
          <>
            <JoinBtn t={t} />
            <Link href={`/student/tournaments/${t.id}`} className={btn.ghost}>
              View details
            </Link>
          </>
        )}
      </div>
    </article>
  );
}

/* ───────────────────────── Browse: finished ───────────────────────── */

export function FinishedCard({ t, meId }: { t: Tournament; meId?: string }) {
  const lb = useLeaderboard(t.id);
  const me = t.isJoined ? lb.data?.standings.find((r) => r.userId === meId) : undefined;
  const winner = lb.data?.standings.find((r) => r.userId === t.winner?.id);
  const rr = lb.data?.roundRobin;
  return (
    <article className={cn(cardCls, "flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between")}>
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill className="bg-[#f1ece2] text-muted-foreground">Completed</Pill>
          {me && me.played > 0 && (
            <Pill className={me.rank === 1 ? "bg-amber-100 text-amber-900" : "bg-sky-50 text-sky-800"}>
              {MEDAL[me.rank] ?? "🎯"} You finished {ordinal(me.rank)}
            </Pill>
          )}
        </div>
        <Link href={`/student/tournaments/${t.id}`} className="block text-xl font-bold tracking-tight text-primary hover:underline">
          {t.name}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <FormatLabel t={t} />
          <span className="font-mono font-semibold text-primary">{tcLabel(t)}</span>
          {t.completedAt && <span>Concluded {formatDate(t.completedAt)}</span>}
          {rr && (
            <span className="font-mono text-xs">
              {rr.completedGames}/{rr.totalGames} games played
            </span>
          )}
        </div>
        {t.winner ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-[#f6f2ea] px-3 py-2">
            <span>🏆</span>
            <span className="text-sm text-muted-foreground">Winner:</span>
            <span className="text-sm font-bold text-brand-orange">{t.winner.name}</span>
            {winner && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-semibold text-amber-900">
                {formatPoints(winner.points)}/{winner.played} pts
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">First place was shared.</p>
        )}
      </div>
      <div className="flex min-w-[200px] flex-col gap-2">
        <Link href={`/student/tournaments/${t.id}`} className={btn.soft}>
          <BarChart3 className="size-4" /> View standings
        </Link>
      </div>
    </article>
  );
}

/* ───────────────────────── My schedule ───────────────────────── */

export function ScheduleCard({ t, meId }: { t: Tournament; meId?: string }) {
  const now = useNow();
  const live = t.status === "ongoing";
  const done = t.status === "completed";
  const lb = useLeaderboard(t.id, live || done);
  const { streak, liveMatchId } = useMyTournamentGames(t.id);
  const me = lb.data?.standings.find((r) => r.userId === meId);
  const href = `/student/tournaments/${t.id}`;
  const total = lb.data?.standings.length ?? t.participantCount;

  return (
    <article className={cn(cardCls, "flex flex-col justify-between gap-5")}>
      {live && <div className="pointer-events-none absolute -right-12 -bottom-12 size-44 rounded-full bg-sky-100/60 blur-2xl" />}
      <div className="relative space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {live && (
              <Pill className="bg-emerald-50 font-mono text-emerald-700">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Live now
              </Pill>
            )}
            {t.status === "open" && (
              <Pill className="bg-emerald-50 text-emerald-800">
                <CheckCircle2 className="size-3.5" /> Confirmed entry
              </Pill>
            )}
            {done &&
              (me && me.rank === 1 && me.played > 0 ? (
                <Pill className="bg-amber-100 font-mono text-amber-900">
                  <Trophy className="size-3.5" /> 1st place · Champion
                </Pill>
              ) : (
                <Pill className="bg-[#f1ece2] text-muted-foreground">Completed</Pill>
              ))}
          </div>
          {t.status === "open" ? (
            <Pill className="bg-[#f1ece2] font-mono text-brand-orange">
              <Timer className="size-3.5" /> {countdown(t.startsAt, now) ?? "Waiting to start"}
            </Pill>
          ) : (
            <span className="font-mono text-[11px] tracking-wider text-brand-orange uppercase">
              {t.format === "round_robin" ? "Round robin" : "Arena"} · {speedCategory(t.timeControl.baseSeconds / 60, t.timeControl.incrementSeconds)}
            </span>
          )}
        </div>

        <div>
          <Link href={href} className="text-xl font-bold tracking-tight text-primary hover:underline">
            {t.name}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-primary">{t.timeControl.label}</span>
            <span>·</span>
            <span>{t.format === "round_robin" ? "Round robin" : "Arena"}</span>
            <span>·</span>
            <span>
              {live && t.startedAt
                ? `Started ${formatDateTime(t.startedAt)}`
                : done && t.completedAt
                  ? `Concluded ${formatDate(t.completedAt)}`
                  : `Starts ${formatDateTime(t.startsAt)}`}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {t.participantCount}
            </span>
          </p>
        </div>

        {(live || done) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f6f2ea] px-4 py-3">
            {me && me.played > 0 ? (
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-brand-orange">#{me.rank}</span>
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {done ? "Final score" : "Your score"}:{" "}
                    <span className="text-brand-orange">
                      {formatPoints(me.points)} / {me.played}
                    </span>
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {done ? `Finished ${ordinal(me.rank)} of ${total}` : `${ordinal(me.rank)} of ${total} · ${me.wins}W ${me.draws}D ${me.losses}L`}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{done ? "You didn’t play any games." : "No games yet — find your first opponent!"}</p>
            )}
            {streak >= 2 && (
              <Pill className="bg-white text-emerald-700 shadow-sm">
                <Flame className="size-3.5" /> {streak}-win streak
              </Pill>
            )}
          </div>
        )}

        {t.status === "open" && (
          <div className="flex items-center gap-3 rounded-xl bg-[#f6f2ea] px-4 py-3">
            <Crown className="size-5 text-brand-orange" />
            <p className="text-sm text-muted-foreground">
              {t.participantCount >= MIN_PLAYERS
                ? `${t.participantCount} players registered — games begin when your coach starts it.`
                : `Waiting for ${MIN_PLAYERS - t.participantCount} more player to join.`}
            </p>
          </div>
        )}
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {live &&
            (liveMatchId ? (
              <Link href={`/match/${liveMatchId}`} className={btn.primary}>
                Resume game <ArrowRight className="size-4" />
              </Link>
            ) : (
              <Link href={href} className={btn.primary}>
                Play <ArrowRight className="size-4" />
              </Link>
            ))}
          <Link href={href} className={btn.soft}>
            {done ? (
              <>
                <LayoutGrid className="size-4" /> {t.format === "round_robin" ? "View crosstable" : "View standings"}
              </>
            ) : live ? (
              <>
                <BarChart3 className="size-4" /> Standings
              </>
            ) : (
              <>
                Tournament page <ArrowRight className="size-4" />
              </>
            )}
          </Link>
        </div>
        {t.status === "open" && <LeaveBtn t={t} />}
      </div>
    </article>
  );
}
