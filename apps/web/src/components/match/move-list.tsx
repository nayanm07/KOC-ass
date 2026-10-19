"use client";

import { Check, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface HistoryMove {
  san: string;
  from: string;
  to: string;
  /** FEN after this move */
  after: string;
}

const navBtn =
  "flex size-9 items-center justify-center rounded-lg bg-[#f1ece2] text-primary transition hover:bg-[#e9e2d5] disabled:opacity-40";

/**
 * Notation panel (PGN). Click a move to review that position; arrows step through;
 * last button returns to the live position. The full PGN can be copied.
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const current = viewPly ?? moves.length;

  // Follow the newest move while live
  useEffect(() => {
    if (viewPly === null && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [moves.length, viewPly]);

  const go = (ply: number) => onViewPly(ply >= moves.length ? null : Math.max(0, ply));

  const rows: { n: number; white: number; black?: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) rows.push({ n: i / 2 + 1, white: i, black: i + 1 < moves.length ? i + 1 : undefined });

  const cell = (idx?: number) =>
    idx === undefined ? (
      <span />
    ) : (
      <button
        type="button"
        onClick={() => go(idx + 1)}
        className={cn(
          "rounded-md px-2 py-1 text-left font-mono text-sm text-primary transition-colors hover:bg-white",
          current === idx + 1 && "bg-primary text-primary-foreground hover:bg-primary",
        )}
      >
        {moves[idx].san}
      </button>
    );

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-primary">
          Notation
          <span className="rounded-md bg-[#f1ece2] px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground">
            {moves.length} {moves.length === 1 ? "move" : "moves"}
          </span>
        </p>
        <button
          type="button"
          disabled={!pgn}
          onClick={() => {
            void navigator.clipboard.writeText(pgn).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#f1ece2] px-3 text-sm font-medium text-primary hover:bg-[#e9e2d5] disabled:opacity-40"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy PGN"}
        </button>
      </div>

      <div ref={scrollRef} className="max-h-72 overflow-y-auto rounded-xl">
        {moves.length === 0 ? (
          <p className="rounded-xl bg-[#f6f2ea] p-3 text-sm text-muted-foreground">No moves yet — white to play.</p>
        ) : (
          rows.map((r) => (
            <div key={r.n} className={cn("grid grid-cols-[2.5rem_1fr_1fr] items-center gap-1 rounded-lg px-1", r.n % 2 === 0 && "bg-[#f6f2ea]")}>
              <span className="py-1 font-mono text-sm text-muted-foreground/70">{r.n}.</span>
              {cell(r.white)}
              {cell(r.black)}
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          <button type="button" className={navBtn} aria-label="First move" disabled={current === 0} onClick={() => go(0)}>
            <ChevronFirst className="size-4" />
          </button>
          <button type="button" className={navBtn} aria-label="Previous move" disabled={current === 0} onClick={() => go(current - 1)}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" className={navBtn} aria-label="Next move" disabled={viewPly === null} onClick={() => go(current + 1)}>
            <ChevronRight className="size-4" />
          </button>
          <button type="button" className={navBtn} aria-label="Back to live position" disabled={viewPly === null} onClick={() => onViewPly(null)}>
            <ChevronLast className="size-4" />
          </button>
        </div>
        <span className="font-mono text-sm text-muted-foreground">
          {current} / {moves.length}
        </span>
      </div>
    </section>
  );
}
