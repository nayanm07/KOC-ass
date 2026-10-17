"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useJoinTournament, useLeaveTournament } from "@/hooks/use-tournaments";
import type { Tournament } from "@/lib/types";

export function JoinButton({ tournament, size = "sm" }: { tournament: Tournament; size?: "sm" | "default" }) {
  const join = useJoinTournament();
  return (
    <Button size={size} disabled={join.isPending} onClick={() => join.mutate(tournament.id)}>
      {join.isPending ? "Joining…" : "Join tournament"}
    </Button>
  );
}

export function LeaveButton({ tournament }: { tournament: Tournament }) {
  const leave = useLeaveTournament();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
        Leave
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Leave this tournament?"
        description="You can join again while registration is still open."
        confirmLabel="Leave"
        destructive
        pending={leave.isPending}
        onConfirm={() => leave.mutate(tournament.id, { onSuccess: () => setConfirm(false) })}
      />
    </>
  );
}

/** Card action for the browse list */
export function StudentCardAction({ tournament: t }: { tournament: Tournament }) {
  if (t.status === "open" && !t.isJoined) return <JoinButton tournament={t} />;
  return (
    <Link href={`/student/tournaments/${t.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
      {t.status === "ongoing" && t.isJoined ? "Play" : "View"}
    </Link>
  );
}
