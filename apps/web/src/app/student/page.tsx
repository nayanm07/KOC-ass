"use client";

import { CalendarCheck, Compass, Medal, Search, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ErrorState, ListSkeleton } from "@/components/states";
import { FinishedCard, LiveCard, OpenCard, ScheduleCard } from "@/components/tournaments/student/student-cards";
import { useMe } from "@/hooks/use-auth";
import { useMyMatches } from "@/hooks/use-matches";
import { useTournaments } from "@/hooks/use-tournaments";
import type { Tournament } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "browse" | "schedule";

/** Real stats from the student's own games (replaces the design's invented rating badge) */
function RecordBadge() {
  const q = useMyMatches();
  const done = (q.data ?? []).filter((m) => m.outcome);
  if (!q.data || done.length === 0) return null;
  const w = done.filter((m) => m.outcome === "win").length;
  const d = done.filter((m) => m.outcome === "draw").length;
  const l = done.length - w - d;
  const rate = Math.round(((w + d / 2) / done.length) * 100);
  return (
    <Link href="/student/matches" className="flex items-center gap-3 self-start rounded-2xl border bg-card px-4 py-2.5 shadow-sm transition hover:shadow-md md:self-auto">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Medal className="size-5" />
      </span>
      <span>
        <span className="flex items-center gap-2 text-xs font-semibold text-primary">
          My record
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">{rate}% score</span>
        </span>
        <span className="font-mono text-base font-bold text-primary">
          <span className="text-emerald-700">{w}W</span> · <span className="text-sky-700">{d}D</span> · <span className="text-red-600">{l}L</span>
        </span>
      </span>
    </Link>
  );
}

function SectionHeader({ title, badge, badgeCls }: { title: string; badge: string; badgeCls?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-brand-orange uppercase">— {title}</p>
      <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold", badgeCls ?? "bg-[#f1ece2] text-muted-foreground")}>{badge}</span>
    </div>
  );
}

const matches = (t: Tournament, q: string) =>
  !q || t.name.toLowerCase().includes(q) || t.timeControl.label.includes(q) || (t.format === "round_robin" ? "round robin" : "arena").includes(q);

function Browse({ list, meId, query }: { list: Tournament[]; meId?: string; query: string }) {
  const q = query.trim().toLowerCase();
  const shown = list.filter((t) => matches(t, q));
  const live = shown.filter((t) => t.status === "ongoing").sort((a, b) => Number(b.isJoined) - Number(a.isJoined));
  const open = shown.filter((t) => t.status === "open").sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const done = shown.filter((t) => t.status === "completed").sort((a, b) => +new Date(b.completedAt ?? 0) - +new Date(a.completedAt ?? 0));

  if (!shown.length) {
    return (
      <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
        <p className="text-4xl">♞</p>
        <p className="mt-2 font-semibold text-primary">{q ? `No tournaments match “${query.trim()}”` : "No tournaments right now"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{q ? "Try another name or time control." : "Check back soon — your coach will open one."}</p>
      </div>
    );
  }
  return (
    <div className="space-y-9">
      {live.length > 0 && (
        <section>
          <SectionHeader title="Live now" badge={`${live.length} in progress`} badgeCls="bg-emerald-50 text-emerald-700" />
          <div className="space-y-4">
            {live.map((t) => (
              <LiveCard key={t.id} t={t} meId={meId} />
            ))}
          </div>
        </section>
      )}
      {open.length > 0 && (
        <section>
          <SectionHeader title="Open for registration" badge={`${open.length} open`} badgeCls="bg-sky-50 text-sky-700" />
          <div className="space-y-4">
            {open.map((t) => (
              <OpenCard key={t.id} t={t} />
            ))}
          </div>
        </section>
      )}
      {done.length > 0 && (
        <section>
          <SectionHeader title="Finished" badge={`${done.length} concluded`} />
          <div className="space-y-4">
            {done.map((t) => (
              <FinishedCard key={t.id} t={t} meId={meId} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Schedule({ list, meId, query, onBrowse }: { list: Tournament[]; meId?: string; query: string; onBrowse: () => void }) {
  const q = query.trim().toLowerCase();
  const mine = list.filter((t) => t.isJoined && matches(t, q));
  const upcoming = mine
    .filter((t) => t.status !== "completed")
    .sort((a, b) => (a.status === "ongoing" ? -1 : 0) - (b.status === "ongoing" ? -1 : 0) || +new Date(a.startsAt) - +new Date(b.startsAt));
  const past = mine.filter((t) => t.status === "completed").sort((a, b) => +new Date(b.completedAt ?? 0) - +new Date(a.completedAt ?? 0));

  if (!mine.length) {
    return (
      <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
        <p className="text-4xl">♟</p>
        <p className="mt-2 font-semibold text-primary">{q ? `Nothing in your schedule matches “${query.trim()}”` : "You haven’t joined any tournaments"}</p>
        <p className="mt-1 text-sm text-muted-foreground">Browse open tournaments and join one to get started.</p>
        <button type="button" onClick={onBrowse} className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
          Browse tournaments
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-9">
      <section>
        <SectionHeader title="Upcoming & live" badge={`${upcoming.length} active & scheduled`} badgeCls="bg-orange-50 text-brand-orange" />
        {upcoming.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {upcoming.map((t) => (
              <ScheduleCard key={t.id} t={t} meId={meId} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed bg-card px-6 py-8 text-center text-sm text-muted-foreground">
            Nothing upcoming — all your tournaments have finished.
          </p>
        )}
      </section>
      {past.length > 0 && (
        <section>
          <SectionHeader title="Past tournaments" badge={`${past.length} completed`} />
          <div className="grid gap-5 md:grid-cols-2">
            {past.map((t) => (
              <ScheduleCard key={t.id} t={t} meId={meId} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function StudentHome() {
  const [view, setView] = useState<View>("browse");
  const [query, setQuery] = useState("");
  const me = useMe();
  const q = useTournaments();
  const list = q.data ?? [];
  const browseCount = list.filter((t) => t.status === "open" || t.status === "ongoing").length;
  const scheduleCount = list.filter((t) => t.isJoined && t.status !== "completed").length;

  const tabs: { v: View; label: string; icon: typeof Compass; n: number }[] = [
    { v: "browse", label: "Browse", icon: Compass, n: browseCount },
    { v: "schedule", label: "My schedule", icon: CalendarCheck, n: scheduleCount },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.2em] text-brand-orange uppercase">— Student</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-primary">Tournaments</h1>
          <p className="mt-1 text-muted-foreground">Join a tournament, then find opponents once it starts.</p>
        </div>
        <RecordBadge />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex self-start rounded-2xl bg-[#ece6da] p-1" role="tablist" aria-label="Tournament views">
          {tabs.map((t) => {
            const on = view === t.v;
            return (
              <button
                key={t.v}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setView(t.v)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all",
                  on ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary",
                )}
              >
                <t.icon className={cn("size-4", on && "text-brand-orange")} />
                {t.label}
                {q.isSuccess && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[11px] font-bold leading-none",
                      on ? "bg-brand-orange text-white" : "bg-[#e1d9ca] text-muted-foreground",
                    )}
                  >
                    {t.n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <label className="relative block lg:w-[26rem]">
          <span className="sr-only">Search tournaments</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or time control (e.g. 5+0)…"
            className="h-11 w-full rounded-xl border border-transparent bg-white pr-9 pl-10 text-sm text-primary shadow-sm outline-none placeholder:text-muted-foreground/80 focus:border-brand-orange focus:ring-3 focus:ring-brand-orange/25 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-primary"
            >
              <X className="size-4" />
            </button>
          )}
        </label>
      </div>

      {q.isPending ? (
        <ListSkeleton rows={3} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : view === "browse" ? (
        <Browse list={list} meId={me.data?.id} query={query} />
      ) : (
        <Schedule list={list} meId={me.data?.id} query={query} onBrowse={() => setView("browse")} />
      )}
    </div>
  );
}
