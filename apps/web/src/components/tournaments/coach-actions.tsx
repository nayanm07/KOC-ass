"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteTournament, useUpdateTournamentStatus } from "@/hooks/use-tournaments";
import type { Tournament, TournamentStatus } from "@/lib/types";
import { TournamentFormDialog } from "./tournament-form-dialog";

interface TransitionUi {
  label: string;
  variant: "default" | "outline";
  confirm?: { title: string; description: string };
}

const TRANSITIONS: Record<TournamentStatus, TransitionUi> = {
  open: { label: "Open registration", variant: "default" },
  draft: { label: "Back to draft", variant: "outline" },
  ongoing: {
    label: "Start tournament",
    variant: "default",
    confirm: {
      title: "Start the tournament?",
      description:
        "Registration closes and players can start finding opponents. Time control and start time become locked.",
    },
  },
  completed: {
    label: "Complete tournament",
    variant: "default",
    confirm: {
      title: "Complete the tournament?",
      description: "No more games can be played and final standings are declared. This cannot be undone.",
    },
  },
};

/** Status buttons (driven by the API's `allowedTransitions`) + edit / delete */
export function CoachTournamentActions({
  tournament,
  redirectAfterDelete,
}: {
  tournament: Tournament;
  redirectAfterDelete?: string;
}) {
  const router = useRouter();
  const setStatus = useUpdateTournamentStatus();
  const del = useDeleteTournament();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<TournamentStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canEdit = tournament.status !== "completed";
  const canDelete = tournament.status === "draft" || tournament.status === "open";
  const confirmUi = confirming ? TRANSITIONS[confirming] : null;

  const transition = (to: TournamentStatus) =>
    setStatus.mutate({ id: tournament.id, status: to }, { onSettled: () => setConfirming(null) });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tournament.allowedTransitions.map((to) => {
        const t = TRANSITIONS[to];
        return (
          <Button
            key={to}
            size="sm"
            variant={t.variant}
            disabled={setStatus.isPending}
            onClick={() => (t.confirm ? setConfirming(to) : transition(to))}
          >
            {t.label}
          </Button>
        );
      })}
      {canEdit && (
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Pencil /> Edit
        </Button>
      )}
      {canDelete && (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete tournament"
          title="Delete tournament"
        >
          <Trash2 />
        </Button>
      )}

      {editing && <TournamentFormDialog open onOpenChange={setEditing} tournament={tournament} />}

      {confirming && confirmUi?.confirm && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirming(null)}
          title={confirmUi.confirm.title}
          description={confirmUi.confirm.description}
          confirmLabel={confirmUi.label}
          pending={setStatus.isPending}
          onConfirm={() => transition(confirming)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${tournament.name}"?`}
        description="This removes the tournament and its participant list. This cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={del.isPending}
        onConfirm={() =>
          del.mutate(tournament.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              if (redirectAfterDelete) router.push(redirectAfterDelete);
            },
          })
        }
      />
    </div>
  );
}
