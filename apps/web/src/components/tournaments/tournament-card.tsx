import { CalendarClock, Clock, Repeat, Swords, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, fromNow } from "@/lib/format";
import type { Tournament } from "@/lib/types";
import { TournamentStatusBadge } from "./status-badge";

export function TournamentMeta({ tournament: t }: { tournament: Tournament }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5" title="Tournament format">
        {t.format === "round_robin" ? <Repeat className="size-3.5" /> : <Swords className="size-3.5" />}
        {t.format === "round_robin" ? "Round robin" : "Arena"}
      </span>
      <span className="inline-flex items-center gap-1.5" title="Time control (minutes + increment seconds)">
        <Clock className="size-3.5" />
        <span className="font-mono text-foreground">{t.timeControl.label}</span>
      </span>
      <span className="inline-flex items-center gap-1.5" title="Start time">
        <CalendarClock className="size-3.5" />
        {formatDateTime(t.startsAt)}
        {t.status !== "completed" && <span className="text-xs">({fromNow(t.startsAt)})</span>}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Users className="size-3.5" />
        {t.participantCount} {t.participantCount === 1 ? "player" : "players"}
      </span>
      {t.winner && (
        <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
          <Trophy className="size-3.5" /> {t.winner.name}
        </span>
      )}
    </div>
  );
}

export function TournamentCard({
  tournament: t,
  href,
  actions,
}: {
  tournament: Tournament;
  href: string;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href} className="truncate text-base font-semibold hover:underline">
              {t.name}
            </Link>
            <TournamentStatusBadge status={t.status} />
            {t.isJoined && <Badge variant="secondary">✓ Joined</Badge>}
          </div>
          <TournamentMeta tournament={t} />
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </CardContent>
    </Card>
  );
}
