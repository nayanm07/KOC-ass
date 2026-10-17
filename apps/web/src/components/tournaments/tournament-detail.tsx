"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { TournamentDetail } from "@/lib/types";
import { TournamentStatusBadge } from "./status-badge";
import { TournamentMeta } from "./tournament-card";

/** Shared detail layout for coach + student; role-specific controls are passed in */
export function TournamentDetailView({
  tournament: t,
  backHref,
  actions,
  highlightUserId,
  children,
}: {
  tournament: TournamentDetail;
  backHref: string;
  actions?: React.ReactNode;
  highlightUserId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" /> All tournaments
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{t.name}</h1>
            <TournamentStatusBadge status={t.status} />
          </div>
          {t.description && <p className="max-w-2xl text-muted-foreground">{t.description}</p>}
          <TournamentMeta tournament={t} />
          <p className="text-xs text-muted-foreground">
            Organised by {t.createdBy.name}
            {t.startedAt && <> · Started {formatDateTime(t.startedAt)}</>}
            {t.completedAt && <> · Completed {formatDateTime(t.completedAt)}</>}
          </p>
        </div>
        {actions}
      </div>

      {children}

      <Card>
        <CardHeader>
          <CardTitle>Players ({t.participants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {t.participants.length === 0 ? (
            <EmptyState
              title="No players yet"
              description={t.status === "open" ? "Students can join while registration is open." : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.participants.map((p, i) => (
                  <TableRow key={p.userId} className={p.userId === highlightUserId ? "bg-accent/60" : undefined}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">
                      {p.name}
                      {p.userId === highlightUserId && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDateTime(p.joinedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
