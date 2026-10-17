"use client";

import { useState } from "react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { StudentCardAction } from "@/components/tournaments/student-actions";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTournaments } from "@/hooks/use-tournaments";
import type { Tournament } from "@/lib/types";

type View = "browse" | "schedule";

function Section({ title, items }: { title: string; items: Tournament[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {items.map((t) => (
        <TournamentCard
          key={t.id}
          tournament={t}
          href={`/student/tournaments/${t.id}`}
          actions={<StudentCardAction tournament={t} />}
        />
      ))}
    </section>
  );
}

function Browse({ onShowSchedule }: { onShowSchedule: () => void }) {
  const q = useTournaments();
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const live = q.data.filter((t) => t.status === "ongoing");
  const open = q.data.filter((t) => t.status === "open");
  const done = q.data.filter((t) => t.status === "completed");

  if (!live.length && !open.length && !done.length) {
    return <EmptyState title="No tournaments right now" description="Check back soon — your coach will open one." />;
  }
  return (
    <div className="space-y-8">
      {!live.length && !open.length && (
        <EmptyState
          title="Nothing open right now"
          description="No tournament is taking registrations or being played at the moment."
          action={
            <Button variant="outline" size="sm" onClick={onShowSchedule}>
              View my schedule
            </Button>
          }
        />
      )}
      <Section title="Live now" items={live} />
      <Section title="Open for registration" items={open} />
      <Section title="Finished" items={done} />
    </div>
  );
}

function Schedule({ onBrowse }: { onBrowse: () => void }) {
  const q = useTournaments({ joined: true });
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const upcoming = q.data
    .filter((t) => t.status !== "completed")
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const past = q.data.filter((t) => t.status === "completed");

  if (!q.data.length) {
    return (
      <EmptyState
        title="You haven't joined any tournaments"
        description="Browse open tournaments and join one to get started."
        action={<Button onClick={onBrowse}>Browse tournaments</Button>}
      />
    );
  }
  return (
    <div className="space-y-8">
      {upcoming.length ? (
        <Section title="Upcoming & live" items={upcoming} />
      ) : (
        <EmptyState title="Nothing upcoming" description="All your tournaments have finished." />
      )}
      <Section title="Past" items={past} />
    </div>
  );
}

export default function StudentHome() {
  const [view, setView] = useState<View>("browse");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tournaments</h1>
        <p className="text-sm text-muted-foreground">Join a tournament, then find opponents once it starts.</p>
      </div>
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="schedule">My schedule</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "browse" ? (
        <Browse onShowSchedule={() => setView("schedule")} />
      ) : (
        <Schedule onBrowse={() => setView("browse")} />
      )}
    </div>
  );
}
