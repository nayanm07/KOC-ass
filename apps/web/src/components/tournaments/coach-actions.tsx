"use client";

import { CheckCircle2, PlayCircle, SlidersHorizontal, Trash2, Undo2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useDeleteTournament, useUpdateTournamentStatus } from "@/hooks/use-tournaments";
import type { Tournament, TournamentStatus } from "@/lib/types";
import { btn } from "./detail/primitives";
import { TournamentFormDialog } from "./tournament-form-dialog";

/** Players needed before a tournament can start (mirrors the API rule) */
export const MIN_PLAYERS = 2;

/** Header actions on the coach's tournament page: edit, status changes (with confirms), delete */
export function CoachTournamentActions({
  tournament: t,
  redirectAfterDelete,
}: {
  tournament: Tournament;
  redirectAfterDelete?: string;
}) {
  const router = useRouter();
  const setStatus = useUpdateTournamentStatus();
  const del = useDeleteTournament();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<null | "ongoing" | "completed" | "delete">(null);

  const go = (to: TournamentStatus) => setStatus.mutate({ id: t.id, status: to }, { onSettled: () => setConfirm(null) });
  const canStart = t.participantCount >= MIN_PLAYERS;
  const canDelete = t.status === "draft" || t.status === "open";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canDelete && (
        <button type="button" className={btn.icon} aria-label="Delete tournament" title="Delete" onClick={() => setConfirm("delete")}>
          <Trash2 className="size-4" />
        </button>
      )}
      {t.status !== "completed" && (
        <button type="button" className={btn.soft} onClick={() => setEditing(true)}>
          <SlidersHorizontal className="size-4" /> Edit
        </button>
      )}

      {t.status === "draft" && (
        <button type="button" className={btn.primary} disabled={setStatus.isPending} onClick={() => go("open")}>
          <Upload className="size-4" /> Open registration
        </button>
      )}
      {t.status === "open" && (
        <>
          {t.participantCount === 0 && (
            <button type="button" className={btn.soft} disabled={setStatus.isPending} onClick={() => go("draft")}>
              <Undo2 className="size-4" /> Back to draft
            </button>
          )}
          <button
            type="button"
            className={btn.orange}
            disabled={!canStart || setStatus.isPending}
            title={canStart ? undefined : `At least ${MIN_PLAYERS} players are needed to start`}
            onClick={() => setConfirm("ongoing")}
          >
            <PlayCircle className="size-4" /> Start tournament
          </button>
        </>
      )}
      {t.status === "ongoing" && (
        <button type="button" className={btn.primary} disabled={setStatus.isPending} onClick={() => setConfirm("completed")}>
          <CheckCircle2 className="size-4" /> Complete tournament
        </button>
      )}

      {editing && <TournamentFormDialog open onOpenChange={setEditing} tournament={t} />}

      <ConfirmDialog
        open={confirm === "ongoing"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Start “${t.name}”?`}
        description="Registration closes and players can start finding opponents. Format, time control and start time become locked."
        confirmLabel="Start tournament"
        pending={setStatus.isPending}
        onConfirm={() => go("ongoing")}
      />
      <ConfirmDialog
        open={confirm === "completed"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Complete “${t.name}”?`}
        description="No more games can be played and the winner is declared from the final standings. This cannot be undone."
        confirmLabel="Complete tournament"
        pending={setStatus.isPending}
        onConfirm={() => go("completed")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete “${t.name}”?`}
        description="This removes the tournament and its participant list. This cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={del.isPending}
        onConfirm={() =>
          del.mutate(t.id, {
            onSuccess: () => {
              setConfirm(null);
              if (redirectAfterDelete) router.push(redirectAfterDelete);
            },
          })
        }
      />
    </div>
  );
}
