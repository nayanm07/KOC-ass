"use client";

import { useEffect, useState } from "react";
import type { Color } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatClock } from "./chess-clock";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Big clock box: counts down locally from the server snapshot; the server alone decides flag-fall */
function ClockBox({ color, ms, running, receivedAt }: { color: Color; ms: number; running: boolean; receivedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);
  const left = running ? Math.max(0, ms - (now - receivedAt)) : ms;
  const low = running && left < 20_000;
  return (
    <div
      role="timer"
      aria-label={`${color} clock ${formatClock(left)}`}
      className={cn(
        "shrink-0 rounded-xl px-4 py-1.5 text-right transition-colors",
        running ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-[#f1ece2] text-primary",
        low && "bg-red-600 text-white shadow-red-600/30",
      )}
    >
      <p className={cn("font-mono text-[10px] font-semibold tracking-[0.18em] uppercase", running ? "text-white/80" : "text-muted-foreground")}>
        {color} clock{running && " · active"}
      </p>
      <p className="font-mono text-3xl leading-tight font-bold tabular-nums">{formatClock(left)}</p>
    </div>
  );
}

export function PlayerCard({
  name,
  color,
  isYou,
  ms,
  running,
  receivedAt,
  toMove,
  live,
  captured,
  lead,
}: {
  name: string;
  color: Color;
  isYou: boolean;
  ms: number;
  running: boolean;
  receivedAt: number;
  toMove: boolean;
  live: boolean;
  /** Glyphs of pieces this player has captured */
  captured: string[];
  /** Material lead in pawns (only shown when > 0) */
  lead: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-3 py-2 shadow-sm sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
          {initials(name)}
          <span
            className={cn(
              "absolute -right-1 -bottom-1 size-4 rounded-full border-2 border-white",
              color === "white" ? "bg-white ring-1 ring-slate-400" : "bg-primary ring-1 ring-primary",
            )}
            aria-label={`plays ${color}`}
          />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-primary">
            {name}
            {isYou && <span className="ml-1.5 text-sm font-semibold text-brand-orange">(you)</span>}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {captured.length > 0 && (
              <span className="flex items-center leading-none tracking-[-0.15em] text-muted-foreground" aria-label={`captured ${captured.length} pieces`}>
                {captured.map((g, i) => (
                  <span key={i} className="text-base">
                    {g}
                  </span>
                ))}
              </span>
            )}
            {lead > 0 && <span className="font-mono font-semibold text-primary">+{lead}</span>}
            {live &&
              (toMove ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-brand-orange">
                  <span className="size-1.5 animate-pulse rounded-full bg-brand-orange" /> To move
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-slate-300" /> Waiting
                </span>
              ))}
          </div>
        </div>
      </div>
      <ClockBox color={color} ms={ms} running={running} receivedAt={receivedAt} />
    </div>
  );
}
