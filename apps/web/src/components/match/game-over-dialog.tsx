"use client";

import { Loader2, Trophy } from "lucide-react";
import Link from "next/link";
import { useMatchmaking } from "@/components/socket-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Color, MatchEndReason, MatchResult, MatchView } from "@/lib/types";

const REASON: Record<MatchEndReason, string> = {
  checkmate: "checkmate",
  resignation: "resignation",
  timeout: "time",
  stalemate: "stalemate",
  insufficient_material: "insufficient material",
  threefold_repetition: "threefold repetition",
  fifty_move_rule: "the 50-move rule",
  draw_agreement: "agreement",
};

export function describeResult(
  result: MatchResult,
  reason: MatchEndReason,
  myColor: Color | null,
): { title: string; detail: string; tone: "win" | "loss" | "draw" } {
  if (result === "draw") {
    return {
      title: "Draw",
      detail: reason === "timeout" ? "Time ran out, but the opponent could not checkmate." : `Drawn by ${REASON[reason]}.`,
      tone: "draw",
    };
  }
  const winner: Color = result === "white_win" ? "white" : "black";
  const how = reason === "timeout" ? "on time" : `by ${REASON[reason]}`;
  if (!myColor) {
    return { title: `${winner === "white" ? "White" : "Black"} wins`, detail: `Won ${how}.`, tone: "win" };
  }
  return winner === myColor
    ? { title: "You won! 🎉", detail: `Won ${how}.`, tone: "win" }
    : { title: "You lost", detail: `Lost ${how}. Good game — keep practising!`, tone: "loss" };
}

export function GameOverDialog({
  match,
  myColor,
  onClose,
}: {
  match: MatchView;
  myColor: Color | null;
  onClose: () => void;
}) {
  const mm = useMatchmaking(match.tournament.id);
  if (!match.result || !match.endReason) return null;
  const r = describeResult(match.result, match.endReason, myColor);
  const isPlayer = !!myColor;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="items-center text-center">
          <Trophy
            className={
              r.tone === "win" ? "size-10 text-amber-500" : r.tone === "draw" ? "size-10 text-sky-500" : "size-10 text-muted-foreground"
            }
          />
          <DialogTitle className="text-2xl">{r.title}</DialogTitle>
          <DialogDescription>{r.detail} The result has been added to the leaderboard.</DialogDescription>
        </DialogHeader>

        {isPlayer && mm.waiting && (
          <p className="flex items-center justify-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin" /> Searching for your next opponent…
          </p>
        )}

        <DialogFooter className="sm:flex-wrap">
          <Link href={isPlayer ? `/student/tournaments/${match.tournament.id}` : `/coach/tournaments/${match.tournament.id}`} className={buttonVariants({ variant: "outline" })}>
            {isPlayer ? "Leaderboard & tournament" : "Back to tournament"}
          </Link>
          <Button variant="ghost" onClick={onClose}>
            Review game
          </Button>
          {isPlayer &&
            (mm.waiting ? (
              <Button variant="outline" disabled={mm.pending} onClick={mm.cancel}>
                Cancel search
              </Button>
            ) : (
              <Button disabled={mm.pending || !mm.connected} onClick={mm.findOpponent}>
                Find next opponent
              </Button>
            ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
