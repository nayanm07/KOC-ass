"use client";

import { Chess } from "chess.js";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Flag,
  Flame,
  Play,
  PlayCircle,
  Scale,
  Search,
  Swords,
  Timer,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChessClock } from "@/components/match/chess-clock";
import { ErrorState, ListSkeleton } from "@/components/states";
import { initials } from "@/components/tournaments/detail/primitives";
import { useMatch, useMyMatches } from "@/hooks/use-matches";
import { formatDateTime } from "@/lib/format";
import { averageMoves, bestWinStreak, mostFrequent, myRecord, topLossReason } from "@/lib/my-stats";
import { END_PHRASE, movesLabel, REASON_LABEL } from "@/lib/tournament-stats";
import type { MyMatchRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "win" | "draw" | "loss" | "live";
const PAGE_SIZE = 10;

const OUTCOME: Record<"win" | "draw" | "loss", { label: string; cls: string }> = {
  win: { label: "Won", cls: "bg-emerald-50 text-emerald-800" },
  draw: { label: "Draw", cls: "bg-sky-50 text-sky-700" },
  loss: { label: "Lost", cls: "bg-red-50 text-red-700" },
};

/* ───────────────────────── Stat cards ───────────────────────── */

function StatCard({
  label,
  icon: Icon,
  value,
  valueCls,
  chip,
  chipCls,
  sub,
}: {
  label: string;
  icon: typeof Trophy;
  value: number;
  valueCls: string;
  chip: string;
  chipCls: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-[#f1ece2] text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={cn("text-4xl font-extrabold tracking-tight tabular-nums", valueCls)}>{value}</span>
        <span className={cn("rounded-full px-2 py-0.5 font-mono text-xs font-semibold", chipCls)}>{chip}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function WinRateRing({ rate, total }: { rate: number; total: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card p-5 shadow-sm">
      <div>
        <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-brand-orange uppercase">Performance</p>
        <p className="mt-1 text-xl font-bold text-primary">Win rate</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Across <span className="font-mono font-semibold text-primary">{total}</span> finished game{total === 1 ? "" : "s"}
        </p>
      </div>
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 72 72" className="size-20 -rotate-90" aria-hidden>
          <circle cx="36" cy="36" r={r} fill="none" stroke="#f1ece2" strokeWidth={7} />
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            stroke="#0b3a63"
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (rate / 100) * c}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-primary">{rate}%</span>
      </div>
    </div>
  );
}

/* ───────────────────────── Live banner ───────────────────────── */

function LiveBanner({ row }: { row: MyMatchRow }) {
  const q = useMatch(row.id);
  const m = q.data;
  const myTurn = m ? m.turn === row.color : (row.moves % 2 === 0) === (row.color === "white");
  const myMs = m ? (row.color === "white" ? m.clock.whiteMs : m.clock.blackMs) : null;
  return (
    <section className="flex flex-col items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-primary via-[#14497a] to-primary p-5 text-white shadow-md md:flex-row">
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-orange">
          <Swords className="size-6 animate-bounce [animation-duration:2s]" />
        </span>
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300 uppercase">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Game in progress
            </span>
            <span className="font-mono text-xs text-white/60">{row.tournament.name}</span>
          </p>
          <p className="mt-0.5 text-xl font-bold">You vs {row.opponent.name}</p>
          <p className="text-sm text-white/80">
            Move {Math.floor(row.moves / 2) + 1} · {myTurn ? <strong className="text-brand-orange">your turn</strong> : "opponent’s turn"} · you play {row.color}
          </p>
        </div>
      </div>
      <div className="flex w-full items-center justify-end gap-3 md:w-auto">
        {m && myMs !== null && (
          <div className="hidden flex-col items-end rounded-lg bg-white/10 px-3 py-1 sm:flex">
            <span className="font-mono text-[10px] text-white/70 uppercase">Your clock</span>
            <ChessClock ms={myMs} running={m.clock.running === row.color} receivedAt={q.dataUpdatedAt} />
          </div>
        )}
        <Link href={`/match/${row.id}`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-orange px-5 font-semibold text-white shadow-md hover:bg-brand-orange/90">
          <Play className="size-4" /> Resume board
        </Link>
      </div>
    </section>
  );
}

/* ───────────────────────── Latest game + highlights ───────────────────────── */

function LatestGame({ row }: { row: MyMatchRow }) {
  const q = useMatch(row.id);
  const sans = useMemo(() => {
    if (!q.data?.pgn) return [];
    const c = new Chess();
    try {
      c.loadPgn(q.data.pgn);
    } catch {
      return [];
    }
    return c.history();
  }, [q.data?.pgn]);
  const white = row.color === "white" ? "You" : row.opponent.name;
  const black = row.color === "black" ? "You" : row.opponent.name;
  const preview = sans.slice(0, 16);
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-brand-orange uppercase">— Latest finished game</p>
          <h3 className="mt-1 text-xl font-bold text-primary">
            {white} vs {black}
          </h3>
          <p className="text-sm text-muted-foreground">
            {row.tournament.name} · {formatDateTime(row.startedAt)}
          </p>
        </div>
        {row.outcome && (
          <span className={cn("rounded-lg px-2.5 py-1 font-mono text-xs font-bold", OUTCOME[row.outcome].cls)}>
            {OUTCOME[row.outcome].label}
            {row.endReason && ` · ${REASON_LABEL[row.endReason]}`}
          </span>
        )}
      </div>
      <div className="mt-4 rounded-xl bg-[#f6f2ea] p-3 font-mono text-[13px] leading-relaxed text-primary">
        {q.isPending ? (
          <span className="text-muted-foreground">Loading moves…</span>
        ) : sans.length === 0 ? (
          <span className="text-muted-foreground">No moves were played.</span>
        ) : (
          <>
            {preview.map((san, i) => (
              <span key={i}>
                {i % 2 === 0 && <span className="text-muted-foreground">{i / 2 + 1}. </span>}
                {san}{" "}
              </span>
            ))}
            {sans.length > preview.length && (
              <span className="text-muted-foreground">
                … {Math.ceil(sans.length / 2)}. {sans[sans.length - 1]}
              </span>
            )}
          </>
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Moves", value: String(Math.ceil(row.moves / 2)) },
          { label: "Result", value: row.outcome ? OUTCOME[row.outcome].label : "—" },
          { label: "Ended by", value: row.endReason ? REASON_LABEL[row.endReason] : "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-[#fbf8f2] p-2.5">
            <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{s.label}</p>
            <p className="font-semibold text-primary">{s.value}</p>
          </div>
        ))}
      </div>
      <Link href={`/match/${row.id}`} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        <BookOpen className="size-4" /> Review full game
      </Link>
    </section>
  );
}

function Highlights({ rows }: { rows: MyMatchRow[] }) {
  const streak = bestWinStreak(rows);
  const rival = mostFrequent(rows, (m) => m.opponent.name);
  const fav = mostFrequent(rows, (m) => m.tournament.name);
  const items = [
    { icon: Flame, label: "Best win streak", value: streak ? `${streak} in a row` : "—" },
    { icon: UserRound, label: "Most played opponent", value: rival ? `${rival.value} (${rival.count})` : "—" },
    { icon: Trophy, label: "Favourite tournament", value: fav ? `${fav.value} (${fav.count})` : "—" },
  ];
  return (
    <section className="flex flex-col justify-between rounded-2xl bg-[#ece6da] p-6 shadow-sm">
      <div>
        <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-brand-orange uppercase">— Highlights</p>
        <ul className="mt-3 space-y-2.5">
          {items.map((i) => (
            <li key={i.label} className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <i.icon className="size-4" />
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">{i.label}</span>
                <span className="block text-sm font-semibold text-primary">{i.value}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <Link href="/student" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        <PlayCircle className="size-4" /> Play another game
      </Link>
    </section>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function MyMatchesPage() {
  const q = useMyMatches();
  const [filter, setFilter] = useState<Filter>("all");
  const [tc, setTc] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => q.data ?? [], [q.data]);
  const rec = myRecord(rows);
  const avg = averageMoves(rows);
  const loss = topLossReason(rows);
  const live = rows.find((m) => m.status === "ongoing");
  const latest = rows.find((m) => m.outcome);
  const controls = [...new Set(rows.map((m) => m.timeControl))].sort();

  const s = query.trim().toLowerCase();
  const shown = rows.filter(
    (m) =>
      (filter === "all" || (filter === "live" ? m.status === "ongoing" : m.outcome === filter)) &&
      (tc === "all" || m.timeControl === tc) &&
      (!s || m.opponent.name.toLowerCase().includes(s) || m.tournament.name.toLowerCase().includes(s)),
  );
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const setF = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };

  const filters: { v: Filter; label: string; n: number; cls?: string }[] = [
    { v: "all", label: "All", n: rows.length },
    { v: "win", label: "Won", n: rec.wins, cls: "bg-emerald-50 text-emerald-800" },
    { v: "draw", label: "Drawn", n: rec.draws, cls: "bg-sky-50 text-sky-700" },
    { v: "loss", label: "Lost", n: rec.losses, cls: "bg-red-50 text-red-700" },
    { v: "live", label: "Live", n: rec.live },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.2em] text-brand-orange uppercase">— Student · Game history</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-primary">My matches</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">Every game you’ve played — open one to replay it move by move.</p>
        </div>
        <Link href="/student" className="inline-flex h-11 items-center gap-2 self-start rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 md:self-auto">
          <PlayCircle className="size-4" /> Find a match
        </Link>
      </div>

      {q.isPending ? (
        <ListSkeleton rows={4} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border bg-card px-6 py-16 text-center shadow-sm">
          <span className="relative mb-4 flex size-24 items-center justify-center rounded-full bg-[#f1ece2] text-6xl text-primary">
            ♞
            <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-orange-100 text-xs">⭐</span>
          </span>
          <h2 className="max-w-lg text-2xl font-bold tracking-tight text-primary">No matches yet — join a tournament and hit Find opponent</h2>
          <p className="mt-2 max-w-md text-muted-foreground">Your games, results and move-by-move replays appear here as soon as you play.</p>
          <Link href="/student" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-orange px-6 font-semibold text-white shadow-md hover:bg-brand-orange/90">
            Browse tournaments <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Games won" icon={Trophy} value={rec.wins} valueCls="text-emerald-700" chip={`${rec.winRate}%`} chipCls="bg-emerald-50 text-emerald-800" sub="of your finished games" />
            <StatCard
              label="Games drawn"
              icon={Scale}
              value={rec.draws}
              valueCls="text-sky-700"
              chip={`${rec.drawRate}%`}
              chipCls="bg-sky-50 text-sky-700"
              sub={
                <>
                  Average game: <span className="font-mono font-semibold text-primary">{avg === null ? "—" : movesLabel(avg)}</span>
                </>
              }
            />
            <StatCard
              label="Games lost"
              icon={Flag}
              value={rec.losses}
              valueCls="text-red-600"
              chip={`${rec.lossRate}%`}
              chipCls="bg-red-50 text-red-700"
              sub={
                loss ? (
                  <>
                    Most losses <span className="font-semibold text-primary">{END_PHRASE[loss.reason]}</span> ({loss.count})
                  </>
                ) : (
                  "No losses yet — keep it up!"
                )
              }
            />
            <WinRateRing rate={rec.winRate} total={rec.total} />
          </div>

          {/* Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block flex-1 lg:max-w-sm">
              <span className="sr-only">Search matches</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by opponent or tournament…"
                className="h-10 w-full rounded-xl border border-transparent bg-[#f6f2ea] pr-9 pl-10 text-sm text-primary outline-none placeholder:text-muted-foreground/80 focus:border-brand-orange focus:ring-3 focus:ring-brand-orange/25 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-primary">
                  <X className="size-4" />
                </button>
              )}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex flex-wrap gap-1 rounded-xl bg-[#f1ece2] p-1" role="tablist" aria-label="Filter by result">
                {filters.map((f) => (
                  <button
                    key={f.v}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.v}
                    onClick={() => setF(f.v)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      filter === f.v ? "bg-white font-semibold text-primary shadow-sm" : "text-muted-foreground hover:text-primary",
                    )}
                  >
                    {f.v === "live" && <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />}
                    {f.label}
                    <span className={cn("rounded-full px-1.5 font-mono text-[11px]", f.cls ?? "bg-white text-muted-foreground")}>{f.n}</span>
                  </button>
                ))}
              </div>
              <label className="inline-flex items-center gap-1.5 rounded-xl bg-[#f1ece2] px-2.5 py-1.5">
                <Timer className="size-4 text-muted-foreground" />
                <span className="sr-only">Time control</span>
                <select
                  value={tc}
                  onChange={(e) => {
                    setTc(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent pr-1 text-sm font-medium text-primary outline-none"
                >
                  <option value="all">All controls</option>
                  {controls.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {live && <LiveBanner row={live} />}

          {/* Table */}
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4">
              <p className="text-lg font-bold text-primary">Game history</p>
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-mono font-bold text-primary">{pageRows.length}</span> of {shown.length}
                {shown.length !== rows.length && ` (filtered from ${rows.length})`}
              </p>
            </div>
            {shown.length === 0 ? (
              <p className="border-t px-6 py-10 text-center text-sm text-muted-foreground">No games match these filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-[#f6f2ea] font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Result</th>
                      <th className="px-3 py-3 text-left font-semibold">Opponent</th>
                      <th className="px-3 py-3 text-center font-semibold">Colour</th>
                      <th className="px-3 py-3 text-left font-semibold">Tournament</th>
                      <th className="px-3 py-3 text-left font-semibold">Game</th>
                      <th className="px-3 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-right font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((m) => {
                      const isLive = m.status === "ongoing";
                      return (
                        <tr key={m.id} className={cn("border-t", isLive && "bg-emerald-50/40")}>
                          <td className="px-4 py-3">
                            {isLive ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-800">
                                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
                              </span>
                            ) : (
                              m.outcome && (
                                <span className="flex flex-col items-start">
                                  <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold", OUTCOME[m.outcome].cls)}>{OUTCOME[m.outcome].label}</span>
                                  {m.endReason && <span className="mt-0.5 ml-1 text-[11px] text-muted-foreground">{END_PHRASE[m.endReason]}</span>}
                                </span>
                              )
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-2.5">
                              <span className="flex size-8 items-center justify-center rounded-full bg-[#f1ece2] text-[11px] font-bold text-primary">{initials(m.opponent.name)}</span>
                              <span className="font-semibold text-primary">{m.opponent.name}</span>
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#fbf8f2] px-2 py-1 font-mono text-[11px] text-primary">
                              <span className={cn("size-2.5 rounded-full border", m.color === "white" ? "border-slate-400 bg-white" : "border-primary bg-primary")} />
                              you: {m.color}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <Link href={`/student/tournaments/${m.tournament.id}`} className="font-medium text-primary hover:text-brand-orange hover:underline">
                              {m.tournament.name}
                            </Link>
                          </td>
                          <td className="px-3 py-3">
                            <span className="block font-mono text-primary">{isLive ? `Move ${Math.floor(m.moves / 2) + 1}` : movesLabel(Math.ceil(m.moves / 2))}</span>
                            <span className="text-xs text-muted-foreground">{m.timeControl}</span>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{formatDateTime(m.startedAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/match/${m.id}`}
                              className={cn(
                                "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
                                isLive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-[#f1ece2] text-primary hover:bg-[#e9e2d5]",
                              )}
                            >
                              {isLive ? <Play className="size-3.5" /> : <BookOpen className="size-3.5" />}
                              {isLive ? "Resume" : "Review"}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {pages > 1 && (
              <div className="flex flex-col items-center justify-between gap-2 border-t bg-[#fbf8f2] px-4 py-3 sm:flex-row">
                <span className="text-sm text-muted-foreground">
                  Games <span className="font-semibold text-primary">{(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, shown.length)}</span> of {shown.length}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current - 1)} className="flex size-8 items-center justify-center rounded-lg bg-white text-muted-foreground shadow-sm hover:text-primary disabled:opacity-40">
                    <ChevronLeft className="size-4" />
                  </button>
                  {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={cn("size-8 rounded-lg text-sm font-semibold shadow-sm", p === current ? "bg-primary text-primary-foreground" : "bg-white text-primary hover:bg-[#f1ece2]")}
                    >
                      {p}
                    </button>
                  ))}
                  <button type="button" aria-label="Next page" disabled={current === pages} onClick={() => setPage(current + 1)} className="flex size-8 items-center justify-center rounded-lg bg-white text-muted-foreground shadow-sm hover:text-primary disabled:opacity-40">
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </section>

          {latest && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <LatestGame row={latest} />
              <Highlights rows={rows} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
