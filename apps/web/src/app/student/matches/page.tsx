"use client";

import Link from "next/link";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMyMatches } from "@/hooks/use-matches";
import { formatDateTime } from "@/lib/format";
import type { MyMatchRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const OUTCOME: Record<NonNullable<MyMatchRow["outcome"]>, { label: string; className: string }> = {
  win: { label: "Won", className: "bg-emerald-100 text-emerald-800" },
  loss: { label: "Lost", className: "bg-red-100 text-red-800" },
  draw: { label: "Draw", className: "bg-sky-100 text-sky-800" },
};

const REASON: Record<string, string> = {
  checkmate: "checkmate",
  resignation: "resignation",
  timeout: "time",
  stalemate: "stalemate",
  insufficient_material: "insufficient material",
  threefold_repetition: "repetition",
  fifty_move_rule: "50-move rule",
  draw_agreement: "agreement",
};

export default function MyMatchesPage() {
  const q = useMyMatches();
  const done = q.data?.filter((m) => m.outcome) ?? [];
  const record = {
    w: done.filter((m) => m.outcome === "win").length,
    d: done.filter((m) => m.outcome === "draw").length,
    l: done.filter((m) => m.outcome === "loss").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My matches</h1>
        <p className="text-sm text-muted-foreground">Every game you’ve played — open one to review it move by move.</p>
      </div>

      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState
          title="No matches yet"
          description="Join a tournament and hit “Find opponent” to play your first game."
          action={
            <Link href="/student" className={buttonVariants()}>
              Browse tournaments
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm">
            Record: <strong>{record.w}</strong> won · <strong>{record.d}</strong> drawn · <strong>{record.l}</strong> lost
          </p>
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Result</TableHead>
                    <TableHead>Opponent</TableHead>
                    <TableHead className="hidden sm:table-cell">Tournament</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        {m.outcome ? (
                          <Badge variant="outline" className={cn("border-transparent", OUTCOME[m.outcome].className)}>
                            {OUTCOME[m.outcome].label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-transparent bg-emerald-600 text-white">
                            ● Live
                          </Badge>
                        )}
                        {m.endReason && (
                          <span className="ml-2 hidden text-xs text-muted-foreground lg:inline">by {REASON[m.endReason]}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{m.opponent.name}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">(you: {m.color})</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Link href={`/student/tournaments/${m.tournament.id}`} className="hover:underline">
                          {m.tournament.name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{formatDateTime(m.startedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/match/${m.id}`}
                          className={buttonVariants({ size: "sm", variant: m.outcome ? "ghost" : "default" })}
                        >
                          {m.outcome ? "Review" : "Resume"}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
