"use client";

import { Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { ErrorState, ListSkeleton } from "@/components/states";
import { CoachTournamentRow } from "@/components/tournaments/coach-tournament-row";
import { TournamentFormDialog } from "@/components/tournaments/tournament-form-dialog";
import { useTournaments } from "@/hooks/use-tournaments";
import type { TournamentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | TournamentStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "ongoing", label: "Live" },
  { value: "completed", label: "Completed" },
];

function NewButton({ onClick, label = "New tournament" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
    >
      <Plus className="size-4" /> {label}
    </button>
  );
}

export default function CoachTournamentsPage() {
  const tournaments = useTournaments();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const all = tournaments.data ?? [];
  const count = (f: Filter) => (f === "all" ? all.length : all.filter((t) => t.status === f).length);
  const q = query.trim().toLowerCase();
  const visible = all.filter((t) => (filter === "all" || t.status === filter) && (!q || t.name.toLowerCase().includes(q)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.2em] text-brand-orange uppercase">— Coach · Tournament desk</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-primary">Tournaments</h1>
          <p className="mt-1 text-muted-foreground">Create events, open registration, start play and declare winners.</p>
        </div>
        <NewButton onClick={() => setCreating(true)} />
      </div>

      {/* Toolbar: status tabs with counts + search */}
      <div className="flex flex-col gap-3 rounded-2xl bg-[#f1ece2] p-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => {
            const on = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors",
                  on ? "bg-primary text-primary-foreground shadow-sm" : "text-primary hover:bg-white/70",
                )}
              >
                {f.value === "ongoing" && <span className="size-1.5 rounded-full bg-emerald-500" />}
                {f.label}
                {tournaments.isSuccess && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 font-mono text-[11px] tabular-nums",
                      on ? "bg-white/20" : "bg-white text-muted-foreground",
                    )}
                  >
                    {count(f.value)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <label className="relative block sm:w-72">
          <span className="sr-only">Search tournaments</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search tournaments…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full rounded-xl border border-transparent bg-white pr-9 pl-10 text-sm text-primary outline-none placeholder:text-muted-foreground/80 focus:border-brand-orange focus:ring-3 focus:ring-brand-orange/25 [&::-webkit-search-cancel-button]:hidden"
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

      {tournaments.isPending ? (
        <ListSkeleton rows={4} />
      ) : tournaments.isError ? (
        <ErrorState error={tournaments.error} onRetry={() => tournaments.refetch()} />
      ) : all.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-16 text-center">
          <div className="relative mb-2">
            <span className="flex size-24 items-center justify-center rounded-3xl bg-[#f1ece2] text-6xl text-primary">♞</span>
            <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-brand-orange text-white">
              <Plus className="size-4" />
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-primary">No tournaments yet</h2>
          <p className="max-w-md text-muted-foreground">
            Create your first tournament — students join, get auto-paired and play on a live clock.
          </p>
          <div className="mt-2">
            <NewButton onClick={() => setCreating(true)} label="Create your first tournament" />
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
          <p className="font-semibold text-primary">No tournaments match</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {q ? `Nothing called “${query.trim()}”` : "Nothing in this status"} —{" "}
            <button
              type="button"
              className="font-medium text-brand-orange hover:underline"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              show all
            </button>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((t) => (
            <CoachTournamentRow key={t.id} tournament={t} />
          ))}
        </div>
      )}

      {creating && <TournamentFormDialog open onOpenChange={setCreating} />}
    </div>
  );
}
