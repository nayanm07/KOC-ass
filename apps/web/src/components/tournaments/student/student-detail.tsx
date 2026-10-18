"use client";

import { CalendarDays, CheckCircle2, Info, LayoutGrid, Loader2, Radar, Swords, Timer, Trophy, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMatchmaking } from "@/components/socket-provider";
import { MIN_PLAYERS } from "@/components/tournaments/coach-actions";
import { formatPoints, StatusPill } from "@/components/tournaments/detail/primitives";
import { speedCategory } from "@/components/tournaments/tournament-form-dialog";
import { useJoinTournament, useLeaveTournament } from "@/hooks/use-tournaments";
import { formatDateTime, fromNow } from "@/lib/format";
import type { Leaderboard, MyMatchRow, TournamentDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** My finished games in this tournament, oldest first, plus my live one */
export function myTournamentGames(all: MyMatchRow[] | undefined, tournamentId: string) {
  const mine = (all ?? []).filter((m) => m.tournament.id === tournamentId);
  const finished = mine.filter((m) => m.outcome).sort((a, b) => +new Date(a.startedAt) - +new Date(b.startedAt));
  let streak = 0;
  for (const g of [...finished].reverse()) {
    if (g.outcome !== "win") break;
    streak++;
  }
  return { finished, live: mine.find((m) => m.status === "ongoing") ?? null, streak };
}

/* ───────────────────────── Header ───────────────────────── */

export function StudentTournamentHeader({
  t,
  lb,
  meId,
  streak,
}: {
  t: TournamentDetail;
  lb?: Leaderboard;
  meId?: string;
  streak: number;
}) {
  const me = lb?.standings.find((r) => r.userId === meId);
  const minutes = t.timeControl.baseSeconds / 60;
  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm">
      <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-orange-100/60 blur-2xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={t.status} />
            <span className="rounded-full bg-sky-50 px-3 py-1 font-mono text-xs font-medium text-sky-800">
              {t.format === "round_robin" ? "Round robin" : "Arena"}
            </span>
            <span className="rounded-full bg-[#f1ece2] px-3 py-1 font-mono text-xs text-muted-foreground">
              {t.participantCount} player{t.participantCount === 1 ? "" : "s"}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">{t.name}</h1>
          {t.description && <p className="max-w-2xl text-muted-foreground">{t.description}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Timer className="size-4 text-brand-orange" />
              <span className="font-mono font-semibold text-primary">{t.timeControl.label}</span>{" "}
              {speedCategory(minutes, t.timeControl.incrementSeconds)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {t.startedAt
                ? `Started ${formatDateTime(t.startedAt)}`
                : `Starts ${formatDateTime(t.startsAt)} (${fromNow(t.startsAt)})`}
            </span>
            <span>Organised by {t.createdBy.name}</span>
          </div>
        </div>

        {me && me.played > 0 && (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-[#f6f2ea] p-4 sm:flex-nowrap">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl bg-white text-brand-orange shadow-sm">
                <Trophy className="size-6" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-brand-orange uppercase">
                  {t.status === "completed" ? "Final standing" : "Your standing"}
                </p>
                <p className="text-2xl font-bold text-primary">
                  {ordinal(me.rank)} <span className="text-sm font-normal text-muted-foreground">of {lb!.standings.length}</span>
                </p>
              </div>
            </div>
            <span className="hidden h-10 w-px bg-border sm:block" />
            <div>
              <p className="flex items-center gap-2">
                <span className="font-mono text-xl font-bold text-primary">
                  {formatPoints(me.points)} pt{me.points === 1 ? "" : "s"}
                </span>
                {streak >= 2 && (
                  <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-brand-orange">🔥 {streak}-win streak</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {me.played} game{me.played === 1 ? "" : "s"} · {me.wins}W {me.draws}D {me.losses}L
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── Matchmaking hero ───────────────────────── */

function useElapsed(since: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return "0:00";
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Hero({
  tone,
  icon,
  eyebrow,
  title,
  body,
  action,
}: {
  tone: "navy" | "searching" | "done" | "neutral";
  icon: React.ReactNode;
  eyebrow: string;
  title: React.ReactNode;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-6 shadow-sm",
        tone === "navy" && "border-primary/10 bg-primary/[0.04]",
        tone === "searching" && "bg-card",
        tone === "done" && "border-emerald-200 bg-emerald-50/60",
        tone === "neutral" && "bg-card",
      )}
    >
      <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          {icon}
          <div className="space-y-1">
            <p
              className={cn(
                "font-mono text-[11px] font-semibold tracking-[0.2em] uppercase",
                tone === "done" ? "text-emerald-800" : "text-brand-orange",
              )}
            >
              — {eyebrow}
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-primary">{title}</h2>
            <div className="max-w-xl text-muted-foreground">{body}</div>
          </div>
        </div>
        {action && <div className="flex w-full shrink-0 justify-end md:w-auto">{action}</div>}
      </div>
    </section>
  );
}

const iconTile = (cls: string, node: React.ReactNode) => (
  <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-sm", cls)}>{node}</span>
);

export function MatchmakingHero({
  t,
  liveMatchId,
  playedEveryone,
}: {
  t: TournamentDetail;
  liveMatchId: string | null;
  playedEveryone: boolean;
}) {
  const mm = useMatchmaking(t.id);
  const elapsed = useElapsed(mm.waiting ? mm.since : null);
  const join = useJoinTournament();
  const leave = useLeaveTournament();

  if (t.status === "completed") return null;

  if (t.status === "open") {
    const ready = t.participantCount >= MIN_PLAYERS;
    return t.isJoined ? (
      <Hero
        tone="neutral"
        icon={iconTile("bg-emerald-100 text-emerald-700", <CheckCircle2 className="size-7" />)}
        eyebrow="Registered"
        title="You’re in! Games start soon."
        body={
          <>
            {ready
              ? `${t.participantCount} players registered — you can find opponents as soon as your coach starts the tournament.`
              : `Waiting for ${MIN_PLAYERS - t.participantCount} more player to join before it can start.`}
          </>
        }
        action={
          <button type="button" disabled={leave.isPending} onClick={() => leave.mutate(t.id)} className="text-sm font-medium text-red-600/80 hover:text-red-700 hover:underline">
            Withdraw entry
          </button>
        }
      />
    ) : (
      <Hero
        tone="navy"
        icon={iconTile("bg-primary text-primary-foreground", <Users className="size-7" />)}
        eyebrow="Registration open"
        title="Want to play?"
        body={`Join now — ${t.participantCount} player${t.participantCount === 1 ? " has" : "s have"} joined so far.`}
        action={
          <button
            type="button"
            disabled={join.isPending}
            onClick={() => join.mutate(t.id)}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90"
          >
            <Trophy className="size-5" /> {join.isPending ? "Joining…" : "Join tournament"}
          </button>
        }
      />
    );
  }

  // ongoing
  if (!t.isJoined) {
    return (
      <Hero
        tone="neutral"
        icon={iconTile("bg-[#f1ece2] text-muted-foreground", <Info className="size-7" />)}
        eyebrow="Registration closed"
        title="This tournament is already underway"
        body="Follow the standings below — join the next one from the Tournaments page."
      />
    );
  }

  if (liveMatchId) {
    return (
      <Hero
        tone="navy"
        icon={iconTile("animate-pulse bg-brand-orange text-white", <Swords className="size-7" />)}
        eyebrow="Game in progress"
        title="You’re in a game!"
        body="Your clock is running on the server — jump back to the board."
        action={
          <Link href={`/match/${liveMatchId}`} className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-orange px-6 text-base font-semibold text-white shadow-md hover:bg-brand-orange/90">
            Return to game
          </Link>
        }
      />
    );
  }

  if (playedEveryone) {
    return (
      <Hero
        tone="done"
        icon={iconTile("bg-emerald-100 text-emerald-700", <CheckCircle2 className="size-7" />)}
        eyebrow="Round robin complete for you"
        title="You’ve played everyone!"
        body="Waiting for the last games to finish — the tournament ends automatically and the winner is declared."
        action={
          <a href="#crosstable" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-primary shadow-sm hover:bg-accent">
            <LayoutGrid className="size-4" /> View crosstable
          </a>
        }
      />
    );
  }

  if (mm.waiting) {
    return (
      <Hero
        tone="searching"
        icon={iconTile("bg-orange-100 text-brand-orange", <Radar className="size-7 animate-spin [animation-duration:3s]" />)}
        eyebrow="Searching"
        title={
          <span className="flex items-center gap-3">
            Searching for an opponent… <span className="font-mono text-brand-orange">{elapsed}</span>
          </span>
        }
        body={
          t.format === "round_robin"
            ? "Looking for someone you haven’t played yet. You’ll be taken to the board automatically."
            : "Pairing you with the closest-ranked player who is also searching. You’ll be taken to the board automatically."
        }
        action={
          <button
            type="button"
            disabled={mm.pending}
            onClick={mm.cancel}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#f1ece2] px-5 text-sm font-semibold text-muted-foreground transition hover:bg-red-50 hover:text-red-700"
          >
            <X className="size-4" /> Cancel search
          </button>
        }
      />
    );
  }

  return (
    <Hero
      tone="navy"
      icon={iconTile("bg-primary text-primary-foreground", <Swords className="size-7" />)}
      eyebrow="Matchmaking"
      title="Ready for your next game?"
      body={
        t.format === "round_robin"
          ? "Round robin — you play everyone once. You’ll be paired with someone you haven’t met yet."
          : "The tournament is live — you’ll be paired with the closest-ranked player who is also looking for a game."
      }
      action={
        <button
          type="button"
          disabled={mm.pending || !mm.connected}
          onClick={mm.findOpponent}
          className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-8 text-lg font-bold text-primary-foreground shadow-md transition hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-60 md:w-auto"
        >
          {mm.pending ? <Loader2 className="size-5 animate-spin" /> : <Swords className="size-5" />}
          {!mm.connected ? "Connecting…" : mm.pending ? "Joining…" : "Find opponent"}
        </button>
      }
    />
  );
}

/* ───────────────────────── Your tournament (sparkline) ───────────────────────── */

export function MyProgressCard({ finished, live }: { finished: MyMatchRow[]; live: MyMatchRow | null }) {
  const scores: number[] = finished.map((g) => (g.outcome === "win" ? 1 : g.outcome === "draw" ? 0.5 : 0));
  const total = scores.reduce((a, b) => a + b, 0);
  const pct = finished.length ? Math.round((total / finished.length) * 100) : 0;
  const cumulative = scores.reduce<number[]>((acc, s) => [...acc, (acc.at(-1) ?? 0) + s], [0]);
  const max = Math.max(1, finished.length);
  const W = 300;
  const H = 70;
  const pts = cumulative.map((v, i) => [(i / max) * W, H - 6 - (v / max) * (H - 12)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-brand-orange uppercase">— Your tournament</p>
        {finished.length > 0 && <span className="font-mono text-xs font-semibold text-emerald-700">{pct}% score</span>}
      </div>
      {finished.length === 0 ? (
        <p className="text-sm text-muted-foreground">{live ? "Your first game is in progress…" : "Play your first game to see your progress here."}</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <p className="text-5xl font-extrabold tracking-tight text-primary">
              {formatPoints(total)}
              <span className="ml-1 text-xl font-semibold text-muted-foreground">/ {finished.length}</span>
            </p>
            <p className="text-right text-sm text-muted-foreground">
              points from {finished.length} game{finished.length === 1 ? "" : "s"}
            </p>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full overflow-visible" aria-label="Your points after each game">
            <defs>
              <linearGradient id="progressFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f47b20" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f47b20" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill="url(#progressFill)" />
            <path d={line} fill="none" stroke="#f47b20" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 5 : 3.5} fill={i === pts.length - 1 ? "#f47b20" : "#0b3a63"} stroke="#fff" strokeWidth={i === pts.length - 1 ? 2 : 0} />
            ))}
          </svg>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
            {finished.map((g, i) => (
              <li key={g.id}>
                G{i + 1}: vs {g.opponent.name.split(" ")[0]}{" "}
                <span className={cn("font-bold", g.outcome === "win" ? "text-emerald-700" : g.outcome === "draw" ? "text-sky-700" : "text-red-600")}>
                  ({g.outcome === "win" ? "W" : g.outcome === "draw" ? "D" : "L"})
                </span>
              </li>
            ))}
            {live && <li className="text-emerald-700">G{finished.length + 1}: vs {live.opponent.name.split(" ")[0]} (LIVE)</li>}
          </ul>
        </>
      )}
    </section>
  );
}

/* ───────────────────────── Format notice ───────────────────────── */

export function FormatNotice({ t }: { t: TournamentDetail }) {
  return (
    <section className="space-y-2 rounded-2xl bg-[#f1ece2] p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Info className="size-4 text-brand-orange" /> How this tournament works
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {t.format === "round_robin" ? (
          <>
            <li>Everyone plays everyone exactly once — you’re only paired with players you haven’t met.</li>
            <li>The tournament ends automatically after the last game.</li>
          </>
        ) : (
          <>
            <li>Play as many games as you like while it’s live — click “Find opponent” after each game.</li>
            <li>You’re paired with the closest-ranked player who is also searching.</li>
          </>
        )}
        <li>Win 1 · Draw ½ · Loss 0. Ties: Sonneborn-Berger, then wins, then head-to-head.</li>
      </ul>
    </section>
  );
}
