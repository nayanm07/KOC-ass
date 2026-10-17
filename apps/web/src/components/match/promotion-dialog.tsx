"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Promotion } from "@/hooks/use-live-match";
import type { Color } from "@/lib/types";

const PIECES: { p: Promotion; white: string; black: string; label: string }[] = [
  { p: "q", white: "♕", black: "♛", label: "Queen" },
  { p: "r", white: "♖", black: "♜", label: "Rook" },
  { p: "b", white: "♗", black: "♝", label: "Bishop" },
  { p: "n", white: "♘", black: "♞", label: "Knight" },
];

export function PromotionDialog({
  color,
  onPick,
  onCancel,
}: {
  color: Color;
  onPick: (p: Promotion) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Promote pawn to…</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2">
          {PIECES.map((x) => (
            <button
              key={x.p}
              type="button"
              autoFocus={x.p === "q"}
              onClick={() => onPick(x.p)}
              className="flex aspect-square flex-col items-center justify-center rounded-lg border text-4xl hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              aria-label={x.label}
              title={x.label}
            >
              {color === "white" ? x.white : x.black}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
