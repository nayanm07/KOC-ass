import type { MatchEndReason, StandingRow, TournamentMatchRow } from "@/lib/types";

/** Pure helpers that turn the games list into the numbers shown on tournament pages */

/** Full moves from half-moves (ply) */
export const fullMoves = (ply: number) => Math.ceil(ply / 2);

/** Side to move in a live game from the half-move count */
export const sideToMove = (ply: number) => (ply % 2 === 0 ? "White" : "Black");

export const REASON_LABEL: Record<MatchEndReason, string> = {
  checkmate: "Checkmate",
  resignation: "Resignation",
  timeout: "Time",
  stalemate: "Stalemate",
  insufficient_material: "Insufficient material",
  threefold_repetition: "Repetition",
  fifty_move_rule: "50-move rule",
  draw_agreement: "Agreed",
};

/** How a game ended, as a phrase: "by checkmate", "on time", "by agreement" … */
export const END_PHRASE: Record<MatchEndReason, string> = {
  checkmate: "by checkmate",
  resignation: "by resignation",
  timeout: "on time",
  stalemate: "by stalemate",
  insufficient_material: "by insufficient material",
  threefold_repetition: "by repetition",
  fifty_move_rule: "by the 50-move rule",
  draw_agreement: "by agreement",
};

/** "1 move", "34 moves" */
export const movesLabel = (n: number) => `${n} move${n === 1 ? "" : "s"}`;

export function completedGames(matches: TournamentMatchRow[]) {
  return matches.filter((m) => m.status === "completed" && m.result);
}

/** Average length of finished games in minutes (null if none) */
export function averageGameMinutes(matches: TournamentMatchRow[]): number | null {
  const done = completedGames(matches).filter((m) => m.endedAt);
  if (!done.length) return null;
  const totalMs = done.reduce((sum, m) => sum + (new Date(m.endedAt!).getTime() - new Date(m.startedAt).getTime()), 0);
  return totalMs / done.length / 60000;
}

export function formatMinutes(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return `${Math.round(min * 60)}s`;
  return `${min.toFixed(1)}m`;
}

/** Shortest / longest finished game by moves (ignores 0-move resignations/timeouts for "shortest") */
export function extremeGames(matches: TournamentMatchRow[]) {
  const played = completedGames(matches).filter((m) => m.moves > 0);
  if (!played.length) return { shortest: null, longest: null };
  const sorted = [...played].sort((a, b) => a.moves - b.moves);
  return { shortest: sorted[0], longest: sorted[sorted.length - 1] };
}

/** Most frequent way games ended */
export function commonEnding(matches: TournamentMatchRow[]): { reason: MatchEndReason; count: number } | null {
  const counts = new Map<MatchEndReason, number>();
  for (const m of completedGames(matches)) if (m.endReason) counts.set(m.endReason, (counts.get(m.endReason) ?? 0) + 1);
  let best: { reason: MatchEndReason; count: number } | null = null;
  for (const [reason, count] of counts) if (!best || count > best.count) best = { reason, count };
  return best;
}

/** Score as a percentage of the maximum (points / games played) */
export const scorePercent = (r: StandingRow) => (r.played ? Math.round((r.points / r.played) * 100) : 0);

/** Every finished game's PGN in one file, newest last */
export function buildPgnExport(matches: TournamentMatchRow[]): string {
  return completedGames(matches)
    .filter((m) => m.pgn)
    .sort((a, b) => +new Date(a.startedAt) - +new Date(b.startedAt))
    .map((m) => m.pgn!.trim())
    .join("\n\n");
}

export function buildStandingsCsv(rows: StandingRow[]): string {
  const header = ["Rank", "Player", "Played", "Wins", "Draws", "Losses", "Sonneborn-Berger", "Points"];
  const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [header, ...rows.map((r) => [r.rank, r.name, r.played, r.wins, r.draws, r.losses, r.sonnebornBerger, r.points])]
    .map((line) => line.map(esc).join(","))
    .join("\n");
}

/** Trigger a browser download of a text file */
export function downloadText(filename: string, content: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const fileSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "tournament";
