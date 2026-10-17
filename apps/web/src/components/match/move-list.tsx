"use client";

import { Check, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HistoryMove {
  san: string;
  from: string;
  to: string;
  /** FEN after this move */
  after: string;
}

/**
 * Move list (PGN panel). Click a move to review that position; arrows step through;
 * "live" returns to the current position. The full PGN can be copied.
 */
export function MoveList({
  moves,
  pgn,
  viewPly,
  onViewPly,
}: {
  moves: HistoryMove[];
  pgn: string;
  /** null = following the live game */
  viewPly: number | null;
  onViewPly: (ply: number | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const current = viewPly ?? moves.length;

  useEffect(() => {
    if (viewPly === null) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [moves.length, viewPly]);

  const go = (ply: number) => onViewPly(ply >= moves.length ? null : Math.max(0, ply));

  const rows: { n: number; white?: number; black?: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) rows.push({ n: i / 2 + 1, white: i, black: i + 1 < moves.length ? i + 1 : undefined });

  const cell = (idx?: number) =>
    idx === undefined ? (
      <span />
    ) : (
      <button
        type="button"
        onClick={() => go(idx + 1)}
        className={cn(
          "rounded px-1.5 py-0.5 text-left font-mono text-sm hover:bg-accent",
          current === idx + 1 && "bg-primary text-primary-foreground hover:bg-primary",
        )}
      >
        {moves[idx].san}
      </button>
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="h-56 overflow-y-auto rounded-md border bg-card p-2">
        {moves.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No moves yet — white to play.</p>
        ) : (
          <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-x-1 gap-y-0.5">
            {rows.map((r) => (
              <div key={r.n} className="contents">
                <span className="py-0.5 text-right font-mono text-sm text-muted-foreground">{r.n}.</span>
                {cell(r.white)}
                {cell(r.black)}
              </div>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <Button size="icon-sm" variant="outline" aria-label="First move" disabled={current === 0} onClick={() => go(0)}>
            <ChevronFirst />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Previous move" disabled={current === 0} onClick={() => go(current - 1)}>
            <ChevronLeft />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Next move" disabled={viewPly === null} onClick={() => go(current + 1)}>
            <ChevronRight />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Back to live position" disabled={viewPly === null} onClick={() => onViewPly(null)}>
            <ChevronLast />
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={!pgn}
          onClick={() => {
            void navigator.clipboard.writeText(pgn).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy PGN"}
        </Button>
      </div>
    </div>
  );
}
