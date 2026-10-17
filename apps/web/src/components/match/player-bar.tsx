import type { Color } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChessClock } from "./chess-clock";

export function PlayerBar({
  name,
  color,
  isYou,
  ms,
  running,
  receivedAt,
  toMove,
}: {
  name: string;
  color: Color;
  isYou: boolean;
  ms: number;
  running: boolean;
  receivedAt: number;
  toMove: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "size-4 shrink-0 rounded-full border",
            color === "white" ? "border-foreground/30 bg-white" : "border-foreground bg-foreground",
          )}
          aria-label={color}
        />
        <span className="truncate font-medium">{name}</span>
        {isYou && <span className="text-xs text-muted-foreground">(you)</span>}
        {toMove && <span className="text-xs font-medium text-brand-orange">● to move</span>}
      </div>
      <ChessClock ms={ms} running={running} receivedAt={receivedAt} />
    </div>
  );
}
