"use client";

import { Crown, Eye, Radio, Trophy } from "lucide-react";
import Link from "next/link";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLeaderboard, useTournamentMatches } from "@/hooks/use-tournaments";
import { formatDateTime } from "@/lib/format";
import type {
  MatchEndReason,
  MatchResult,
  StandingRow,
  TournamentDetail,
  TournamentMatchRow,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/** 1.5 → "1½", 0.5 → "½" */
export function formatPoints(p: number): string {
  const whole = Math.floor(p);
  const half = p - whole >= 0.5;
  if (!half) return String(whole);
  return whole === 0 ? "½" : `${whole}½`;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const RESULT: Record<MatchResult, string> = {
  white_win: "1–0",
  black_win: "0–1",
  draw: "½–½",
};
const REASON: Record<MatchEndReason, string> = {
  checkmate: "Checkmate",
  resignation: "Resignation",
  timeout: "Time",
  stalemate: "Stalemate",
  insufficient_material: "Insufficient material",
  threefold_repetition: "Repetition",
  fifty_move_rule: "50-move rule",
  draw_agreement: "Agreed",
};

export function WinnerBanner({ tournament }: { tournament: TournamentDetail }) {
  if (tournament.status !== "completed") return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
      <Trophy className="size-8 shrink-0 text-amber-500" />
      {tournament.winner ? (
        <div>
          <p className="text-xs font-medium tracking-wide text-amber-800 uppercase">
            Tournament winner
          </p>
          <p className="text-xl font-semibold">{tournament.winner.name}</p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-medium tracking-wide text-amber-800 uppercase">
            Tournament complete
          </p>
          <p className="font-medium">
            First place is shared — see the final standings below.
          </p>
        </div>
      )}
    </div>
  );
}

export function TournamentStats({ tournamentId }: { tournamentId: string }) {
  const q = useLeaderboard(tournamentId);
  if (q.isPending) {
    return (
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
        role="status"
        aria-label="Loading stats"
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[74px]" />
        ))}
      </div>
    );
  }
  if (!q.data) return null; // the leaderboard card below shows the error + retry
  const s = q.data.stats;
  const items = [
    { label: "Players", value: s.players },
    { label: "Games played", value: s.gamesPlayed },
    { label: "Live now", value: s.liveGames, live: s.liveGames > 0 },
    {
      label: "White / Black / Draw",
      value: `${s.whiteWins} / ${s.blackWins} / ${s.draws}`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((i) => (
        <Card key={i.label} size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">{i.label}</p>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                i.live && "text-emerald-600",
              )}
            >
              {i.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function LeaderboardCard({
  tournament,
  highlightUserId,
}: {
  tournament: TournamentDetail;
  highlightUserId?: string;
}) {
  const q = useLeaderboard(tournament.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>
          Win 1 · Draw ½ · Loss 0. Ties broken by Sonneborn-Berger (SB), then
          wins, then head-to-head.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <ListSkeleton rows={2} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.standings.length === 0 ? (
          <EmptyState title="No players yet" />
        ) : (
          <>
            {q.data.roundRobin && <RoundRobinProgress {...q.data.roundRobin} />}
            {q.data.leader && tournament.status === "ongoing" && (
              <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Crown className="size-4 text-amber-500" /> Currently leading:{" "}
                <strong className="text-foreground">
                  {q.data.leader.name}
                </strong>
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-center" title="Games played">
                    P
                  </TableHead>
                  <TableHead className="text-center" title="Wins">
                    W
                  </TableHead>
                  <TableHead className="text-center" title="Draws">
                    D
                  </TableHead>
                  <TableHead className="text-center" title="Losses">
                    L
                  </TableHead>
                  <TableHead
                    className="text-center"
                    title="Sonneborn-Berger tiebreak"
                  >
                    SB
                  </TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.standings.map((r) => {
                  const isWinner = q.data.winner?.userId === r.userId;
                  return (
                    <TableRow
                      key={r.userId}
                      className={cn(
                        r.userId === highlightUserId && "bg-accent/60",
                      )}
                    >
                      <TableCell className="font-medium tabular-nums">
                        {r.played > 0 && MEDAL[r.rank]
                          ? `${MEDAL[r.rank]} `
                          : ""}
                        {r.rank}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.name}
                        {isWinner && (
                          <Trophy
                            className="ml-1.5 inline size-4 text-amber-500"
                            aria-label="Winner"
                          />
                        )}
                        {r.userId === highlightUserId && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {r.played}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {r.wins}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {r.draws}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {r.losses}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground tabular-nums">
                        {r.sonnebornBerger}
                      </TableCell>
                      <TableCell className="text-right text-base font-semibold tabular-nums">
                        {formatPoints(r.points)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {q.data.roundRobin && (
              <Crosstable
                tournamentId={tournament.id}
                standings={q.data.standings}
                highlightUserId={highlightUserId}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RoundRobinProgress({
  totalGames,
  completedGames,
}: {
  totalGames: number;
  completedGames: number;
}) {
  const pct = totalGames ? Math.round((completedGames / totalGames) * 100) : 0;
  return (
    <div className="mb-4 space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium">Round robin progress</span>
        <span className="text-muted-foreground tabular-nums">
          {completedGames} / {totalGames} games
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Classic round-robin grid: row player's result against each column player */
function Crosstable({
  tournamentId,
  standings,
  highlightUserId,
}: {
  tournamentId: string;
  standings: StandingRow[];
  highlightUserId?: string;
}) {
  const q = useTournamentMatches(tournamentId);
  if (!q.data) return null;

  const cell = (
    rowId: string,
    colId: string,
  ): { text: string; className?: string } => {
    const game: TournamentMatchRow | undefined = q.data.find(
      (m) =>
        (m.white.id === rowId && m.black.id === colId) ||
        (m.white.id === colId && m.black.id === rowId),
    );
    if (!game) return { text: "" };
    if (game.status === "ongoing")
      return { text: "●", className: "text-emerald-600" };
    if (game.result === "draw") return { text: "½", className: "bg-sky-50" };
    const rowWon = (game.result === "white_win") === (game.white.id === rowId);
    return rowWon
      ? { text: "1", className: "bg-emerald-50 font-semibold" }
      : { text: "0", className: "bg-red-50" };
  };

  return (
    <div className="mt-6 space-y-2">
      <p className="text-sm font-medium">Crosstable</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left font-medium text-muted-foreground">
                Player
              </th>
              {standings.map((c, i) => (
                <th
                  key={c.userId}
                  className="w-10 p-2 text-center font-medium text-muted-foreground"
                  title={c.name}
                >
                  {i + 1}
                </th>
              ))}
              <th className="p-2 text-right font-medium text-muted-foreground">
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((r, i) => (
              <tr
                key={r.userId}
                className={cn(
                  "border-t",
                  r.userId === highlightUserId && "bg-accent/60",
                )}
              >
                <td className="p-2 whitespace-nowrap">
                  <span className="mr-2 text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  {r.name}
                </td>
                {standings.map((c) => {
                  if (c.userId === r.userId)
                    return <td key={c.userId} className="border bg-muted/70" />;
                  const v = cell(r.userId, c.userId);
                  return (
                    <td
                      key={c.userId}
                      className={cn(
                        "border p-2 text-center tabular-nums",
                        v.className,
                      )}
                    >
                      {v.text}
                    </td>
                  );
                })}
                <td className="p-2 text-right font-semibold tabular-nums">
                  {formatPoints(r.points)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        1 win · ½ draw · 0 loss · ● in progress · blank = not played yet
      </p>
    </div>
  );
}

/** Per-match results. `canOpen` decides which games link to the board (coach: all; student: own). */
export function MatchResultsCard({
  tournamentId,
  canOpen,
  emptyHint,
}: {
  tournamentId: string;
  canOpen: (whiteId: string, blackId: string) => boolean;
  emptyHint?: string;
}) {
  const q = useTournamentMatches(tournamentId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Games</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <ListSkeleton rows={2} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState title="No games yet" description={emptyHint} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>White</TableHead>
                <TableHead className="text-center">Result</TableHead>
                <TableHead>Black</TableHead>
                <TableHead className="hidden sm:table-cell">How</TableHead>
                <TableHead className="hidden md:table-cell">Played</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((m) => {
                const live = m.status === "ongoing";
                const whiteWon = m.result === "white_win";
                const blackWon = m.result === "black_win";
                return (
                  <TableRow key={m.id}>
                    <TableCell className={cn(whiteWon && "font-semibold")}>
                      {m.white.name}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {live ? (
                        <span className="inline-flex items-center gap-1 font-sans text-xs font-medium text-emerald-600">
                          <Radio className="size-3" /> Live
                        </span>
                      ) : (
                        m.result && RESULT[m.result]
                      )}
                    </TableCell>
                    <TableCell className={cn(blackWon && "font-semibold")}>
                      {m.black.name}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {live
                        ? `${m.moves} moves`
                        : m.endReason && REASON[m.endReason]}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDateTime(m.startedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canOpen(m.white.id, m.black.id) && (
                        <Link
                          href={`/match/${m.id}`}
                          className={buttonVariants({
                            size: "sm",
                            variant: live ? "default" : "ghost",
                          })}
                        >
                          <Eye /> {live ? "Watch" : "Review"}
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
