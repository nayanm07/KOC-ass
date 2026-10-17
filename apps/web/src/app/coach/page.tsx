"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { CoachTournamentActions } from "@/components/tournaments/coach-actions";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { TournamentFormDialog } from "@/components/tournaments/tournament-form-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTournaments } from "@/hooks/use-tournaments";
import type { TournamentStatus } from "@/lib/types";

type Filter = "all" | TournamentStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "ongoing", label: "Live" },
  { value: "completed", label: "Completed" },
];

export default function CoachTournamentsPage() {
  const tournaments = useTournaments();
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);

  const all = tournaments.data ?? [];
  const visible = filter === "all" ? all : all.filter((t) => t.status === filter);
  const count = (f: Filter) => (f === "all" ? all.length : all.filter((t) => t.status === f).length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tournaments</h1>
          <p className="text-sm text-muted-foreground">
            Create events, open registration, start play and declare winners.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> New tournament
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
              {tournaments.isSuccess && <span className="ml-1 text-xs text-muted-foreground">{count(f.value)}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tournaments.isPending ? (
        <ListSkeleton />
      ) : tournaments.isError ? (
        <ErrorState error={tournaments.error} onRetry={() => tournaments.refetch()} />
      ) : visible.length === 0 ? (
        all.length === 0 ? (
          <EmptyState
            title="No tournaments yet"
            description="Create your first tournament — students can join once you open registration."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus /> New tournament
              </Button>
            }
          />
        ) : (
          <EmptyState title={`No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} tournaments`} />
        )
      ) : (
        <div className="space-y-3">
          {visible.map((t) => (
            <TournamentCard
              key={t.id}
              tournament={t}
              href={`/coach/tournaments/${t.id}`}
              actions={<CoachTournamentActions tournament={t} />}
            />
          ))}
        </div>
      )}

      {creating && <TournamentFormDialog open onOpenChange={setCreating} />}
    </div>
  );
}
