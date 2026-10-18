import type { MatchEndReason, MyMatchRow } from "@/lib/types";

/** Pure stats over a student's own games (newest-first input is fine — helpers sort as needed) */

export function myRecord(rows: MyMatchRow[]) {
  const finished = rows.filter((m) => m.outcome);
  const wins = finished.filter((m) => m.outcome === "win").length;
  const draws = finished.filter((m) => m.outcome === "draw").length;
  const losses = finished.length - wins - draws;
  const pct = (n: number) => (finished.length ? Math.round((n / finished.length) * 100) : 0);
  return {
    finished,
    total: finished.length,
    wins,
    draws,
    losses,
    live: rows.filter((m) => m.status === "ongoing").length,
    winRate: pct(wins),
    drawRate: pct(draws),
    lossRate: pct(losses),
  };
}

/** Average length of finished games in full moves (null if none) */
export function averageMoves(rows: MyMatchRow[]): number | null {
  const f = rows.filter((m) => m.outcome);
  if (!f.length) return null;
  return Math.round(f.reduce((s, m) => s + Math.ceil(m.moves / 2), 0) / f.length);
}

/** How I lose most often (null with no losses) */
export function topLossReason(rows: MyMatchRow[]): { reason: MatchEndReason; count: number } | null {
  const counts = new Map<MatchEndReason, number>();
  for (const m of rows) if (m.outcome === "loss" && m.endReason) counts.set(m.endReason, (counts.get(m.endReason) ?? 0) + 1);
  let best: { reason: MatchEndReason; count: number } | null = null;
  for (const [reason, count] of counts) if (!best || count > best.count) best = { reason, count };
  return best;
}

/** Longest run of consecutive wins, in the order games were played */
export function bestWinStreak(rows: MyMatchRow[]): number {
  const ordered = rows.filter((m) => m.outcome).sort((a, b) => +new Date(a.startedAt) - +new Date(b.startedAt));
  let best = 0;
  let run = 0;
  for (const m of ordered) {
    run = m.outcome === "win" ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Most frequent value of `key` among finished games */
export function mostFrequent(rows: MyMatchRow[], key: (m: MyMatchRow) => string): { value: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const m of rows) if (m.outcome) counts.set(key(m), (counts.get(key(m)) ?? 0) + 1);
  let best: { value: string; count: number } | null = null;
  for (const [value, count] of counts) if (!best || count > best.count) best = { value, count };
  return best;
}
