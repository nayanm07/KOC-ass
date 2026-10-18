"use client";

import { Clock, Flag, Gamepad2, Hash, Trophy, UserRound } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import type { Leaderboard, StandingRow, Tournament, TournamentMatchRow } from "@/lib/types";
import {
  averageGameMinutes,
  commonEnding,
  completedGames,
  extremeGames,
  formatMinutes,
  fullMoves,
  movesLabel,
  REASON_LABEL,
  scorePercent,
} from "@/lib/tournament-stats";
import { cn } from "@/lib/utils";
import { Eyebrow, formatPoints, Panel } from "./primitives";

/* ───────────────────────── Champion ───────────────────────── */

export function ChampionBanner({ tournament, lb }: { tournament: Tournament; lb: Leaderboard }) {
  const champ = lb.standings.find((r) => r.userId === lb.winner?.userId);
  if (!champ) {
    const firsts = lb.standings.filter((r) => r.rank === 1 && r.played > 0);
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <Eyebrow>Tournament complete</Eyebrow>
        <p className="mt-2 text-2xl font-bold text-primary">
          {firsts.length > 1 ? `Shared first place: ${firsts.map((f) => f.name).join(", ")}` : "No games were played"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {firsts.length > 1 ? "Still level after every tiebreak, so no single winner was declared." : `${tournament.name} ended without results.`}
        </p>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50/60 to-white p-6 shadow-sm sm:p-8">
      <Trophy className="pointer-events-none absolute -top-6 -right-6 size-48 text-amber-200/40" aria-hidden />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="relative flex size-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-500/30">
            <Trophy className="size-11 text-primary" strokeWidth={2.2} />
            <span className="absolute -bottom-2.5 rounded-md bg-primary px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white">
              1ST PLACE
            </span>
          </div>
          <div>
            <Eyebrow>Tournament champion</Eyebrow>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">{champ.name}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Winner of <span className="font-medium text-primary">{tournament.name}</span>
              {tournament.completedAt && ` · ${formatDateTime(tournament.completedAt)}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x rounded-2xl border bg-white/90 py-3 text-center shadow-sm">
          <ChampStat label="Final score" value={`${champ.points.toFixed(1)}`} suffix={`/ ${champ.played}`} note={`${scorePercent(champ)}% score`} accent />
          <ChampStat label="Record" value={`${champ.wins}-${champ.draws}-${champ.losses}`} note="W · D · L" />
          <ChampStat label="SB tiebreak" value={champ.sonnebornBerger.toFixed(2)} note="Sonneborn-Berger" />
        </div>
      </div>
    </section>
  );
}

function ChampStat({ label, value, suffix, note, accent }: { label: string; value: string; suffix?: string; note: string; accent?: boolean }) {
  return (
    <div className="px-5">
      <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl font-bold tabular-nums", accent ? "text-brand-orange" : "text-primary")}>
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}
      </p>
      <p className={cn("text-[11px]", accent ? "text-brand-orange" : "text-muted-foreground")}>{note}</p>
    </div>
  );
}

/* ───────────────────────── Status summary ───────────────────────── */

export function StatusSummary({ tournament, lb, matches }: { tournament: Tournament; lb: Leaderboard; matches: TournamentMatchRow[] }) {
  const rr = lb.roundRobin;
  const total = rr ? rr.totalGames : lb.stats.gamesPlayed;
  const done = rr ? rr.completedGames : lb.stats.gamesPlayed;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const finished = tournament.status === "completed";
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <span className={cn("size-2 rounded-full", finished ? "bg-emerald-500" : "animate-pulse bg-brand-orange")} />
          Tournament status
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {rr ? `${done} of ${total} games played` : `${done} game${done === 1 ? "" : "s"} played`}
          </span>
        </p>
        <span className={cn("rounded-md px-2 py-0.5 font-mono text-xs font-semibold", finished ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-brand-orange")}>
          {finished ? "Concluded" : rr ? `${pct}% complete` : "In progress"}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ece6da]">
        <div className="h-full rounded-full bg-brand-orange transition-all" style={{ width: `${rr ? pct : finished ? 100 : 0}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
        <span className="inline-flex items-center gap-1.5">
          <Hash className="size-3.5" /> Games: <strong className="text-primary">{lb.stats.gamesPlayed}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" /> Average game: <strong className="font-mono text-primary">{formatMinutes(averageGameMinutes(matches))}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Flag className="size-3.5" /> {tournament.format === "round_robin" ? "Round robin" : "Arena"} · {tournament.timeControl.label}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="size-3.5" /> Organised by <strong className="text-primary">{tournament.createdBy.name}</strong>
        </span>
      </div>
    </section>
  );
}

/* ───────────────────────── Analysis ───────────────────────── */

export function AnalysisCard({ lb, matches }: { lb: Leaderboard; matches: TournamentMatchRow[] }) {
  const s = lb.stats;
  const decisive = s.whiteWins + s.blackWins;
  const whitePct = decisive ? Math.round((s.whiteWins / decisive) * 100) : 50;
  const { shortest, longest } = extremeGames(matches);
  const ending = commonEnding(matches);
  const rows = [
    shortest && { icon: Gamepad2, label: "Shortest game", value: `${fullMoves(shortest.moves)} moves`, hint: `${shortest.white.name} vs ${shortest.black.name}` },
    longest && { icon: Gamepad2, label: "Longest game", value: `${fullMoves(longest.moves)} moves`, hint: `${longest.white.name} vs ${longest.black.name}` },
    ending && { icon: Flag, label: "Most common finish", value: REASON_LABEL[ending.reason], hint: `${ending.count} game${ending.count === 1 ? "" : "s"}` },
    { icon: Clock, label: "Average game", value: formatMinutes(averageGameMinutes(matches)), hint: "Start to finish" },
  ].filter(Boolean) as { icon: typeof Clock; label: string; value: string; hint: string }[];

  return (
    <Panel eyebrow="Analysis" title="Tournament stats">
      <div className="flex justify-between text-xs font-medium text-muted-foreground">
        <span>White wins ({s.whiteWins})</span>
        <span>Draws ({s.draws})</span>
        <span>Black wins ({s.blackWins})</span>
      </div>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[#ece6da]">
        <span className="bg-primary" style={{ width: `${whitePct}%` }} />
        <span className="bg-brand-orange" style={{ width: `${100 - whitePct}%` }} />
      </div>
      <ul className="mt-5 space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 rounded-xl bg-[#f6f2ea] px-3.5 py-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white text-brand-orange">
              <r.icon className="size-4" />
            </span>
            <span className="flex-1">
              <span className="block text-xs text-muted-foreground">{r.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground/80">{r.hint}</span>
            </span>
            <span className="font-mono text-sm font-semibold text-primary">{r.value}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ───────────────────────── Game archive ───────────────────────── */

export function GameArchive({ matches }: { matches: TournamentMatchRow[] }) {
  const games = completedGames(matches).sort((a, b) => +new Date(a.startedAt) - +new Date(b.startedAt));
  if (!games.length) return null;
  return (
    <Panel eyebrow="Game archive" title="Every game" subtitle="Open any game to replay it move by move.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {games.map((m, i) => (
          <article key={m.id} className="rounded-2xl border bg-[#fbf8f2] p-4">
            <div className="flex items-center justify-between font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
              <span>Game {i + 1}</span>
              <span>{formatDateTime(m.startedAt)}</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {(["white", "black"] as const).map((side) => {
                const p = m[side];
                const score = m.result === "draw" ? "½" : (m.result === "white_win") === (side === "white") ? "1" : "0";
                return (
                  <div key={side} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={cn("size-3 rounded-full border", side === "white" ? "border-slate-400 bg-white" : "border-primary bg-primary")} />
                      <span className={cn("text-sm text-primary", score === "1" && "font-bold")}>{p.name}</span>
                    </span>
                    <span className={cn("font-mono text-sm font-semibold", score === "1" ? "text-emerald-700" : score === "½" ? "text-sky-700" : "text-red-600")}>
                      {score}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>
                {m.endReason && REASON_LABEL[m.endReason]} · {movesLabel(fullMoves(m.moves))}
              </span>
              <Link href={`/match/${m.id}`} className="font-semibold text-brand-orange hover:underline">
                Review ›
              </Link>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

/* ───────────────────────── Crosstable ───────────────────────── */

export function CrosstableCard({
  standings,
  matches,
  completed,
  highlightUserId,
}: {
  standings: StandingRow[];
  matches: TournamentMatchRow[];
  completed: boolean;
  highlightUserId?: string;
}) {
  const cell = (rowId: string, colId: string): { text: string; cls: string } => {
    const g = matches.find((m) => (m.white.id === rowId && m.black.id === colId) || (m.white.id === colId && m.black.id === rowId));
    if (!g) return { text: "", cls: "" };
    if (g.status === "ongoing") return { text: "●", cls: "text-emerald-600" };
    if (g.result === "draw") return { text: "½", cls: "bg-sky-50 text-sky-700" };
    const rowWon = (g.result === "white_win") === (g.white.id === rowId);
    return rowWon ? { text: "1", cls: "bg-emerald-50 text-emerald-700" } : { text: "0", cls: "bg-red-50 text-red-600" };
  };

  return (
    <Panel
      eyebrow="Crosstable"
      title="Round robin grid"
      right={
        <span className={cn("rounded-md px-2 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase", completed ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-brand-orange")}>
          {completed ? "Final" : "In progress"}
        </span>
      }
    >
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-[#f6f2ea] font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            <tr>
              <th className="w-12 px-3 py-3 text-left font-semibold">#</th>
              <th className="px-2 py-3 text-left font-semibold">Player</th>
              {standings.map((_, i) => (
                <th key={i} className="w-12 px-1 py-3 text-center font-semibold">
                  {i + 1}
                </th>
              ))}
              <th className="bg-[#efe9dd] px-3 py-3 text-center font-semibold">Total</th>
              <th className="px-3 py-3 text-right font-semibold">SB</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((r, i) => (
              <tr key={r.userId} className={cn("border-t", r.userId === highlightUserId && "bg-accent/60")}>
                <td className="px-3 py-2.5">
                  <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold", i === 0 ? "bg-amber-100 text-amber-800" : "bg-[#f1ece2] text-primary")}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-2 py-2.5 font-medium whitespace-nowrap text-primary">
                  {r.name}
                  {i === 0 && completed && <span className="ml-1 text-brand-orange">★</span>}
                </td>
                {standings.map((c) => {
                  if (c.userId === r.userId)
                    return (
                      <td key={c.userId} className="bg-[#efe9dd] px-1 py-2.5 text-center text-muted-foreground">
                        ×
                      </td>
                    );
                  const v = cell(r.userId, c.userId);
                  return (
                    <td key={c.userId} className="px-1 py-2.5 text-center">
                      {v.text && <span className={cn("inline-flex size-7 items-center justify-center rounded-md font-mono text-sm font-semibold", v.cls)}>{v.text}</span>}
                    </td>
                  );
                })}
                <td className="bg-[#f6f2ea] px-3 py-2.5 text-center font-mono text-lg font-bold text-primary tabular-nums">{formatPoints(r.points)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-muted-foreground tabular-nums">{r.sonnebornBerger.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
        Key:
        <span className="rounded bg-emerald-50 px-1.5 text-emerald-700">1 win</span>
        <span className="rounded bg-sky-50 px-1.5 text-sky-700">½ draw</span>
        <span className="rounded bg-red-50 px-1.5 text-red-600">0 loss</span>
        <span className="text-emerald-600">● live</span>
        <span>blank = not played yet</span>
      </p>
    </Panel>
  );
}
