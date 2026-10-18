"use client";

import { Download, Eye, Gamepad2, PieChart, Radio, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/states";
import type { Leaderboard, StandingRow, Tournament, TournamentMatchRow } from "@/lib/types";
import {
  averageGameMinutes,
  buildPgnExport,
  completedGames,
  downloadText,
  fileSlug,
  formatMinutes,
  fullMoves,
  REASON_LABEL,
  scorePercent,
  sideToMove,
} from "@/lib/tournament-stats";
import { cn } from "@/lib/utils";
import { Avatar, btn, formatPoints, MEDAL, Panel, ptsLabel, ResultChip } from "./primitives";

/* ───────────────────────── Stat cards ───────────────────────── */

function StatCard({
  label,
  icon: Icon,
  tone = "default",
  children,
  sub,
}: {
  label: string;
  icon: typeof Users;
  tone?: "default" | "live";
  children: React.ReactNode;
  sub: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className={cn("font-mono text-[11px] font-semibold tracking-[0.18em] uppercase", tone === "live" ? "text-emerald-700" : "text-muted-foreground")}>
          {label}
        </p>
        <span className={cn("flex size-9 items-center justify-center rounded-xl", tone === "live" ? "bg-emerald-50 text-emerald-600" : "bg-[#f1ece2] text-primary")}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3">{children}</div>
      <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

export function StatCards({ lb, matches }: { lb: Leaderboard; matches: TournamentMatchRow[] }) {
  const s = lb.stats;
  const decided = s.whiteWins + s.blackWins + s.draws;
  const pct = (n: number) => (decided ? Math.round((n / decided) * 100) : 0);
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Players" icon={Users} sub={<span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" />Registered</span>}>
        <p className="text-4xl font-extrabold text-primary tabular-nums">{s.players}</p>
      </StatCard>
      <StatCard label="Games played" icon={Gamepad2} sub={`Avg game: ${formatMinutes(averageGameMinutes(matches))}`}>
        <p className="text-4xl font-extrabold text-primary tabular-nums">{s.gamesPlayed}</p>
      </StatCard>
      <StatCard label="Live now" icon={Radio} tone="live" sub={`${s.liveGames * 2} players at the board`}>
        <p className="inline-flex items-center gap-2 text-4xl font-extrabold text-emerald-600 tabular-nums">
          {s.liveGames}
          {s.liveGames > 0 && <span className="size-2.5 animate-pulse rounded-full bg-emerald-500" />}
        </p>
      </StatCard>
      <StatCard
        label="White / Black / Draw"
        icon={PieChart}
        sub={
          <span className="flex justify-between font-mono">
            <span>W {pct(s.whiteWins)}%</span>
            <span>B {pct(s.blackWins)}%</span>
            <span>D {pct(s.draws)}%</span>
          </span>
        }
      >
        <p className="font-mono text-3xl font-bold text-primary tabular-nums">
          {s.whiteWins}/{s.blackWins}/{s.draws}
        </p>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#ece6da]">
          <span className="bg-primary" style={{ width: `${pct(s.whiteWins)}%` }} />
          <span className="bg-[#b4510d]" style={{ width: `${pct(s.blackWins)}%` }} />
          <span className="bg-slate-300" style={{ width: `${pct(s.draws)}%` }} />
        </div>
      </StatCard>
    </div>
  );
}

/* ───────────────────────── Standings ───────────────────────── */

function recordLine(r: StandingRow) {
  if (!r.played) return "No games yet";
  return `${r.played} game${r.played === 1 ? "" : "s"} · ${scorePercent(r)}% score`;
}

export function StandingsTable({ rows, highlightUserId, winnerId }: { rows: StandingRow[]; highlightUserId?: string; winnerId?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-[#f6f2ea] font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Rank</th>
            <th className="px-2 py-3 text-left font-semibold">Player</th>
            <th className="px-2 py-3 text-center font-semibold" title="Played">P</th>
            <th className="px-2 py-3 text-center font-semibold text-emerald-700" title="Wins">W</th>
            <th className="px-2 py-3 text-center font-semibold text-sky-700" title="Draws">D</th>
            <th className="px-2 py-3 text-center font-semibold text-red-600" title="Losses">L</th>
            <th className="px-2 py-3 text-right font-semibold" title="Sonneborn-Berger">SB</th>
            <th className="px-4 py-3 text-right font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.userId}
              className={cn(
                "border-t",
                r.rank === 1 && r.played > 0 && "bg-orange-50/50",
                r.userId === highlightUserId && "bg-accent/70",
              )}
            >
              <td className="px-4 py-3 font-medium tabular-nums">
                {r.played > 0 && MEDAL[r.rank] ? <span className="text-lg">{MEDAL[r.rank]}</span> : r.rank}
              </td>
              <td className="px-2 py-3">
                <span className="flex items-center gap-3">
                  <Avatar name={r.name} rank={r.played > 0 ? r.rank : undefined} />
                  <span>
                    <span className="block font-semibold text-primary">
                      {r.name}
                      {r.userId === winnerId && <span className="ml-1.5" title="Winner">🏆</span>}
                      {r.userId === highlightUserId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                    </span>
                    <span className="block font-mono text-[11px] text-muted-foreground">{recordLine(r)}</span>
                  </span>
                </span>
              </td>
              <td className="px-2 py-3 text-center font-mono tabular-nums">{r.played}</td>
              <td className="px-2 py-3 text-center font-mono text-emerald-700 tabular-nums">{r.wins}</td>
              <td className="px-2 py-3 text-center font-mono text-sky-700 tabular-nums">{r.draws}</td>
              <td className="px-2 py-3 text-center font-mono text-red-600 tabular-nums">{r.losses}</td>
              <td className="px-2 py-3 text-right font-mono text-muted-foreground tabular-nums">{r.sonnebornBerger.toFixed(2)}</td>
              <td className="px-4 py-3 text-right text-xl font-extrabold text-primary tabular-nums">{formatPoints(r.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StandingsPanel({ tournament, lb, highlightUserId }: { tournament: Tournament; lb: Leaderboard; highlightUserId?: string }) {
  const leaderId = lb.winner?.userId ?? lb.leader?.userId;
  const leader = lb.standings.find((r) => r.userId === leaderId);
  // Nobody alone in first: show who shares the lead instead of hiding the card
  const joint = !leader ? lb.standings.filter((r) => r.rank === 1 && r.played > 0) : [];
  return (
    <Panel
      title={tournament.status === "completed" ? "Final standings" : "Tournament standings"}
      subtitle="Win 1 · Draw ½ · Loss 0 · ties: Sonneborn-Berger, wins, head-to-head"
      right={
        <span className="rounded-lg bg-[#f1ece2] px-3 py-1.5 font-mono text-xs font-semibold text-primary">
          {tournament.format === "round_robin" ? "Round robin" : "Arena"} · {tournament.timeControl.label}
        </span>
      }
    >
      {leader && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl bg-orange-50 px-5 py-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-orange-100 text-2xl">👑</span>
          <div className="flex-1">
            <p className="font-semibold text-primary">{leader.name}</p>
            <p className="font-mono text-xs font-semibold text-brand-orange">
              {ptsLabel(leader.points)} · {leader.losses === 0 ? "Undefeated" : `${leader.wins}W ${leader.draws}D ${leader.losses}L`}
              {lb.winner ? " · Winner" : " · Leading"}
            </p>
          </div>
          <p className="font-mono text-3xl font-bold text-brand-orange tabular-nums">{leader.points.toFixed(1)}</p>
        </div>
      )}
      {joint.length > 1 && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl bg-orange-50 px-5 py-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-orange-100 text-2xl">👑</span>
          <div className="flex-1">
            <p className="font-semibold text-primary">{joint.map((r) => r.name).join(" · ")}</p>
            <p className="font-mono text-xs font-semibold text-brand-orange">
              Joint leaders · {ptsLabel(joint[0].points)} each — level on every tiebreak
            </p>
          </div>
          <p className="font-mono text-3xl font-bold text-brand-orange tabular-nums">{joint[0].points.toFixed(1)}</p>
        </div>
      )}
      {lb.standings.length === 0 ? (
        <EmptyState title="No players yet" />
      ) : (
        <StandingsTable rows={lb.standings} highlightUserId={highlightUserId} winnerId={lb.winner?.userId} />
      )}
    </Panel>
  );
}

/* ───────────────────────── Games table ───────────────────────── */

type GamesFilter = "all" | "live" | "completed";

function PlayerCell({ name, color, won }: { name: string; color: "white" | "black"; won: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={cn("size-3 shrink-0 rounded-[3px] border", color === "white" ? "border-slate-400 bg-white" : "border-primary bg-primary")} />
      <span className={cn("text-primary", won ? "font-bold" : "font-normal")}>{name}</span>
    </span>
  );
}

export function GamesPanel({
  tournament,
  matches,
  canOpen,
}: {
  tournament: Tournament;
  matches: TournamentMatchRow[];
  canOpen: (m: TournamentMatchRow) => boolean;
}) {
  const [filter, setFilter] = useState<GamesFilter>("all");
  const live = matches.filter((m) => m.status === "ongoing");
  const done = completedGames(matches);
  const shown = filter === "live" ? live : filter === "completed" ? done : matches;
  const pgn = buildPgnExport(matches);

  const tabs: { v: GamesFilter; label: string; n: number }[] = [
    { v: "all", label: "All", n: matches.length },
    { v: "live", label: "Live", n: live.length },
    { v: "completed", label: "Completed", n: done.length },
  ];

  return (
    <Panel
      title="Tournament games"
      subtitle={`${live.length} live · ${done.length} finished`}
      right={
        <div className="flex rounded-xl bg-[#f1ece2] p-1" role="tablist" aria-label="Filter games">
          {tabs.map((t) => (
            <button
              key={t.v}
              type="button"
              role="tab"
              aria-selected={filter === t.v}
              onClick={() => setFilter(t.v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                filter === t.v ? "bg-white font-semibold text-primary shadow-sm" : "text-muted-foreground hover:text-primary",
              )}
            >
              {t.label} <span className="font-mono text-xs">{t.n}</span>
              {t.v === "live" && t.n > 0 && <span className="size-1.5 rounded-full bg-emerald-500" />}
            </button>
          ))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <EmptyState
          title={filter === "live" ? "No games in progress" : "No games yet"}
          description={tournament.status === "ongoing" ? "Players are paired automatically when they click “Find opponent”." : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-[#f6f2ea] font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">White</th>
                <th className="px-2 py-3 text-center font-semibold">Result</th>
                <th className="px-2 py-3 text-left font-semibold">Black</th>
                <th className="px-2 py-3 text-left font-semibold">How</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => {
                const isLive = m.status === "ongoing";
                return (
                  <tr key={m.id} className={cn("border-t", isLive && "bg-emerald-50/40")}>
                    <td className="px-4 py-3">
                      <PlayerCell name={m.white.name} color="white" won={m.result === "white_win"} />
                    </td>
                    <td className="px-2 py-3 text-center">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-emerald-700">
                          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Live · {fullMoves(m.moves)} moves
                        </span>
                      ) : (
                        m.result && <ResultChip result={m.result} />
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <PlayerCell name={m.black.name} color="black" won={m.result === "black_win"} />
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-muted-foreground">
                      {isLive
                        ? `Move ${fullMoves(m.moves) + (m.moves % 2 === 0 ? 1 : 0)} · ${sideToMove(m.moves)} to move`
                        : m.endReason && `${REASON_LABEL[m.endReason]} · ${fullMoves(m.moves)} moves`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canOpen(m) && (
                        <Link
                          href={`/match/${m.id}`}
                          className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
                            isLive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-primary hover:bg-accent",
                          )}
                        >
                          <Eye className="size-3.5" /> {isLive ? "Watch" : "Review"}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pgn && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className={btn.soft}
            onClick={() => downloadText(`${fileSlug(tournament.name)}.pgn`, pgn, "application/x-chess-pgn")}
          >
            <Download className="size-4" /> Export PGN ({done.length} game{done.length === 1 ? "" : "s"})
          </button>
        </div>
      )}
    </Panel>
  );
}
