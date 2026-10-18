"use client";

import { AlertTriangle, ArrowRight, CalendarDays, Check, Crown, LayoutGrid, Trophy, X, Zap } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCreateTournament, useUpdateTournament } from "@/hooks/use-tournaments";
import { errorMessage } from "@/lib/api";
import { fromDateTimeLocal, localTimezoneLabel, toDateTimeLocal } from "@/lib/format";
import type { Tournament, TournamentFormat } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRESETS = [
  [1, 0],
  [3, 0],
  [3, 2],
  [5, 0],
  [5, 3],
  [10, 0],
  [10, 5],
  [15, 10],
] as const;

const FORMATS: {
  value: TournamentFormat;
  title: string;
  body: string;
  tags: string;
  icon: typeof Crown;
}[] = [
  {
    value: "arena",
    title: "Arena",
    body: "Play as many games as you like, paired with the closest-ranked waiting player. You end it.",
    tags: "Continuous · Standings pairing",
    icon: Crown,
  },
  {
    value: "round_robin",
    title: "Round robin",
    body: "Everyone plays everyone exactly once. Ends automatically after the last game.",
    tags: "Everyone once · Auto-finish",
    icon: LayoutGrid,
  },
];

/** Standard speed category from estimated game length (base + 40 × increment) */
export function speedCategory(minutes: number, increment: number): string {
  const est = minutes * 60 + 40 * increment;
  if (est < 180) return "Bullet";
  if (est < 480) return "Blitz";
  if (est < 1500) return "Rapid";
  return "Classical";
}

function defaultStart(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

const fieldCls =
  "h-11 w-full rounded-xl border border-input bg-[#fbf8f2] px-4 text-primary outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-brand-orange focus:ring-3 focus:ring-brand-orange/25 disabled:cursor-not-allowed disabled:opacity-60";

function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-primary">
        {children}
      </label>
      {hint && <span className="font-mono text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Create (no `tournament`) or edit (with `tournament`). Mount it only while open so state resets. */
export function TournamentFormDialog({
  open,
  onOpenChange,
  tournament,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament?: Tournament;
}) {
  const editing = !!tournament;
  const locked = tournament?.status === "ongoing"; // format, time control + start lock once started
  const create = useCreateTournament();
  const update = useUpdateTournament();
  const mutation = editing ? update : create;

  const [name, setName] = useState(tournament?.name ?? "");
  const [description, setDescription] = useState(tournament?.description ?? "");
  const [format, setFormat] = useState<TournamentFormat>(tournament?.format ?? "arena");
  const [baseMinutes, setBaseMinutes] = useState(tournament ? tournament.timeControl.baseSeconds / 60 : 5);
  const [incrementSeconds, setIncrementSeconds] = useState(tournament?.timeControl.incrementSeconds ?? 0);
  const [startsAt, setStartsAt] = useState(toDateTimeLocal(tournament?.startsAt ?? defaultStart()));

  const close = () => {
    mutation.reset();
    onOpenChange(false);
  };

  const submit = (status: "draft" | "open") => {
    const schedule = {
      format,
      baseMinutes: Number(baseMinutes),
      incrementSeconds: Number(incrementSeconds),
      startsAt: fromDateTimeLocal(startsAt),
    };
    const details = { name, description: description.trim() };
    if (editing) {
      update.mutate({ id: tournament.id, input: locked ? details : { ...details, ...schedule } }, { onSuccess: close });
    } else {
      create.mutate({ ...details, ...schedule, status }, { onSuccess: close });
    }
  };

  const category = speedCategory(Number(baseMinutes), Number(incrementSeconds));

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : !mutation.isPending && close())}>
      <DialogContent showCloseButton={false} className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="h-1 shrink-0 bg-gradient-to-r from-brand-orange via-brand-orange/70 to-primary" />

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b px-6 pt-5 pb-4 sm:px-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-brand-orange uppercase">
                — {editing ? "Edit event" : "Create event"}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                Coach
              </span>
            </div>
            <DialogTitle className="mt-1.5 text-2xl font-extrabold tracking-tight text-primary">
              {editing ? "Edit tournament" : "New tournament"}
            </DialogTitle>
            <DialogDescription className="sr-only">Set the name, format, time control and start time.</DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            disabled={mutation.isPending}
            className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body (scrolls on short screens; header + footer stay put) */}
        <form
          id="tournament-form"
          className="flex-1 space-y-4 overflow-y-auto px-6 py-4 sm:px-8"
          onSubmit={(e) => {
            e.preventDefault();
            submit("draft");
          }}
        >
          {mutation.isError && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {errorMessage(mutation.error)}
            </div>
          )}

          <div>
            <FieldLabel htmlFor="t-name" hint="Shown to students">
              Tournament name <span className="text-brand-orange">*</span>
            </FieldLabel>
            <div className="relative">
              <input
                id="t-name"
                required
                minLength={3}
                maxLength={120}
                placeholder="e.g. Sunday Blitz Cup"
                className={cn(fieldCls, "pr-11")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Trophy className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-brand-orange" />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="t-desc" hint="Optional">
              Description
            </FieldLabel>
            <textarea
              id="t-desc"
              maxLength={1000}
              rows={1}
              placeholder="Who it's for, prizes, anything students should know…"
              className={cn(fieldCls, "h-auto min-h-11 resize-y py-2.5")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <fieldset disabled={locked} className="disabled:opacity-60">
            <FieldLabel hint={locked ? "Locked after start" : undefined}>
              Format <span className="text-brand-orange">*</span>
            </FieldLabel>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tournament format">
              {FORMATS.map((f) => {
                const on = format === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setFormat(f.value)}
                    className={cn(
                      "relative rounded-2xl border p-3.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-brand-orange/40 focus-visible:outline-none",
                      on ? "border-brand-orange/50 bg-orange-50" : "border-border bg-[#f6f2ea] hover:border-primary/30",
                    )}
                  >
                    <span className="flex items-center gap-2.5 pr-7">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          on ? "bg-orange-100 text-brand-orange" : "bg-white text-primary",
                        )}
                      >
                        <f.icon className="size-4" />
                      </span>
                      <span className="font-semibold text-primary">{f.title}</span>
                    </span>
                    <span
                      className={cn(
                        "absolute top-3.5 right-3.5 flex size-5 items-center justify-center rounded-full",
                        on ? "bg-brand-orange text-white" : "bg-border",
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="mt-2 block text-sm leading-snug text-muted-foreground">{f.body}</span>
                    <span
                      className={cn(
                        "mt-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] uppercase",
                        on ? "text-brand-orange" : "text-muted-foreground",
                      )}
                    >
                      {f.value === "arena" ? <Zap className="size-3" /> : <CalendarDays className="size-3" />}
                      {f.tags}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset disabled={locked} className="disabled:opacity-60">
            <FieldLabel
              hint={
                <span className="font-semibold text-brand-orange">
                  {category}: {Number(baseMinutes)} min + {Number(incrementSeconds)}s
                </span>
              }
            >
              Time control <span className="text-brand-orange">*</span>
            </FieldLabel>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(([m, i]) => {
                const on = Number(baseMinutes) === m && Number(incrementSeconds) === i;
                return (
                  <button
                    key={`${m}+${i}`}
                    type="button"
                    onClick={() => {
                      setBaseMinutes(m);
                      setIncrementSeconds(i);
                    }}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 font-mono text-sm transition-colors",
                      on ? "bg-primary text-primary-foreground" : "bg-[#f1ece2] text-primary hover:bg-[#e9e2d5]",
                    )}
                  >
                    {m}+{i}
                    {on && (
                      <>
                        <span className="font-sans text-xs font-semibold">{speedCategory(m, i)}</span>
                        <span className="size-1.5 rounded-full bg-brand-orange" />
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 rounded-2xl bg-[#f6f2ea] px-4 py-3">
              <div>
                <label htmlFor="t-min" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Minutes per player
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="t-min"
                    type="number"
                    min={1}
                    max={180}
                    required
                    className={cn(fieldCls, "bg-white font-mono")}
                    value={baseMinutes}
                    onChange={(e) => setBaseMinutes(Number(e.target.value))}
                  />
                  <span className="font-mono text-xs text-muted-foreground">min</span>
                </div>
              </div>
              <div>
                <label htmlFor="t-inc" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Increment (per move)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="t-inc"
                    type="number"
                    min={0}
                    max={180}
                    required
                    className={cn(fieldCls, "bg-white font-mono")}
                    value={incrementSeconds}
                    onChange={(e) => setIncrementSeconds(Number(e.target.value))}
                  />
                  <span className="font-mono text-xs text-muted-foreground">sec</span>
                </div>
              </div>
            </div>
          </fieldset>

          <div>
            <FieldLabel htmlFor="t-start" hint={<span className="text-brand-orange">Start time</span>}>
              Schedule
            </FieldLabel>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <CalendarDays className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="t-start"
                  type="datetime-local"
                  required
                  disabled={locked}
                  className={cn(fieldCls, "pl-11 font-mono")}
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#f1ece2] px-4 font-mono text-xs font-semibold text-primary">
                <span className="size-1.5 rounded-full bg-brand-orange" />
                {localTimezoneLabel()}
              </span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-[#f6f2ea] px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={close}
            disabled={mutation.isPending}
            className="rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground hover:text-primary"
          >
            Cancel
          </button>
          <div className="flex flex-wrap gap-3">
            {editing ? (
              <button
                type="submit"
                form="tournament-form"
                disabled={mutation.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-70"
              >
                {mutation.isPending ? "Saving…" : "Save changes"}
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  form="tournament-form"
                  disabled={mutation.isPending}
                  className="h-11 rounded-xl border border-border bg-white px-5 text-sm font-semibold text-primary transition hover:bg-accent disabled:opacity-70"
                >
                  Save as draft
                </button>
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => {
                    const form = document.getElementById("tournament-form") as HTMLFormElement | null;
                    if (form && !form.reportValidity()) return;
                    submit("open");
                  }}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-70"
                >
                  {mutation.isPending ? "Creating…" : "Create & open registration"}
                  {!mutation.isPending && <ArrowRight className="size-4" />}
                </button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
