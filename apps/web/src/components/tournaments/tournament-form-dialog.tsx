"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateTournament,
  useUpdateTournament,
} from "@/hooks/use-tournaments";
import { errorMessage } from "@/lib/api";
import {
  fromDateTimeLocal,
  localTimezoneLabel,
  toDateTimeLocal,
} from "@/lib/format";
import type { Tournament, TournamentFormat } from "@/lib/types";
import { cn } from "@/lib/utils";

const FORMATS: { value: TournamentFormat; title: string; body: string }[] = [
  {
    value: "arena",
    title: "Arena",
    body: "Play as many games as you like. Paired with the closest-ranked waiting player. Coach ends it.",
  },
  {
    value: "round_robin",
    title: "Round robin",
    body: "Everyone plays everyone exactly once. Ends automatically after the last game.",
  },
];

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

function defaultStart(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
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
  const locked = tournament?.status === "ongoing"; // time control + start are locked once started
  const create = useCreateTournament();
  const update = useUpdateTournament();
  const mutation = editing ? update : create;

  const [name, setName] = useState(tournament?.name ?? "");
  const [description, setDescription] = useState(tournament?.description ?? "");
  const [baseMinutes, setBaseMinutes] = useState(
    tournament ? tournament.timeControl.baseSeconds / 60 : 5,
  );
  const [incrementSeconds, setIncrementSeconds] = useState(
    tournament?.timeControl.incrementSeconds ?? 0,
  );
  const [startsAt, setStartsAt] = useState(
    toDateTimeLocal(tournament?.startsAt ?? defaultStart()),
  );
  const [publish, setPublish] = useState(false);
  const [format, setFormat] = useState<TournamentFormat>(
    tournament?.format ?? "arena",
  );

  const close = () => {
    mutation.reset();
    onOpenChange(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const schedule = {
      format,
      baseMinutes: Number(baseMinutes),
      incrementSeconds: Number(incrementSeconds),
      startsAt: fromDateTimeLocal(startsAt),
    };
    const details = { name, description: description.trim() };

    if (editing) {
      update.mutate(
        {
          id: tournament.id,
          input: locked ? details : { ...details, ...schedule },
        },
        { onSuccess: close },
      );
    } else {
      create.mutate(
        { ...details, ...schedule, status: publish ? "open" : "draft" },
        { onSuccess: close },
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) =>
        o ? onOpenChange(true) : !mutation.isPending && close()
      }
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit tournament" : "New tournament"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the tournament details."
              : "Players are paired automatically once it starts."}
          </DialogDescription>
        </DialogHeader>

        <form id="tournament-form" onSubmit={submit} className="space-y-4">
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(mutation.error)}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="t-name">Name</Label>
            <Input
              id="t-name"
              required
              minLength={3}
              maxLength={120}
              placeholder="e.g. Sunday Blitz Arena"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-desc">Description (optional)</Label>
            <Textarea
              id="t-desc"
              maxLength={1000}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <fieldset className="space-y-2 disabled:opacity-60" disabled={locked}>
            <Label>Format</Label>
            <div
              className="grid gap-2 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Tournament format"
            >
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={format === f.value}
                  onClick={() => setFormat(f.value)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
                    format === f.value &&
                      "border-primary bg-primary/5 ring-2 ring-primary/30",
                  )}
                >
                  <span className="block text-sm font-medium">{f.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {f.body}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2 disabled:opacity-60" disabled={locked}>
            <Label>
              Time control{" "}
              {locked && (
                <span className="text-xs text-muted-foreground">
                  (locked after start)
                </span>
              )}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(([m, i]) => {
                const active =
                  Number(baseMinutes) === m && Number(incrementSeconds) === i;
                return (
                  <Button
                    key={`${m}+${i}`}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className="font-mono"
                    onClick={() => {
                      setBaseMinutes(m);
                      setIncrementSeconds(i);
                    }}
                  >
                    {m}+{i}
                  </Button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label
                  htmlFor="t-min"
                  className="text-xs text-muted-foreground"
                >
                  Minutes per player
                </Label>
                <Input
                  id="t-min"
                  type="number"
                  min={1}
                  max={180}
                  required
                  value={baseMinutes}
                  onChange={(e) => setBaseMinutes(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="t-inc"
                  className="text-xs text-muted-foreground"
                >
                  Increment (sec per move)
                </Label>
                <Input
                  id="t-inc"
                  type="number"
                  min={0}
                  max={180}
                  required
                  value={incrementSeconds}
                  onChange={(e) => setIncrementSeconds(Number(e.target.value))}
                />
              </div>
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="t-start">
              Starts at{" "}
              <span className="text-xs text-muted-foreground">
                ({localTimezoneLabel()})
              </span>
            </Label>
            <Input
              id="t-start"
              type="datetime-local"
              required
              disabled={locked}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>

          {!editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
              />
              Open registration immediately (otherwise saved as a draft)
            </label>
          )}
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            disabled={mutation.isPending}
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="tournament-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create tournament"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
