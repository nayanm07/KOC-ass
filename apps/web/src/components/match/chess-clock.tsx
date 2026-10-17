"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  if (total < 10_000) return `0:${String(seconds).padStart(2, "0")}.${Math.floor((total % 1000) / 100)}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Displays one side's clock. The server sends `ms` at the moment `receivedAt`; if this side is
 * running we count down locally between server snapshots. The server alone decides flag-fall.
 */
export function ChessClock({ ms, running, receivedAt }: { ms: number; running: boolean; receivedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);

  const left = running ? Math.max(0, ms - (now - receivedAt)) : ms;
  return (
    <span
      className={cn(
        "rounded-md px-3 py-1.5 font-mono text-2xl font-semibold tabular-nums transition-colors",
        running ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        running && left < 20_000 && "bg-destructive text-white",
      )}
      aria-label={`Clock ${formatClock(left)}`}
      role="timer"
    >
      {formatClock(left)}
    </span>
  );
}
