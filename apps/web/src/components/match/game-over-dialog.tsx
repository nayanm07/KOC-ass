"use client";

import { BarChart3, Handshake, Loader2, Shield, SkipForward, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { useMatchmaking } from "@/components/socket-provider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Color, MatchEndReason, MatchResult, MatchView } from "@/lib/types";
import { cn } from "@/lib/utils";

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
): { title: string; detail: string; tone: "win" | "loss" | "draw"; badge: string } {
  if (result === "draw") {
    return {
      title: "Draw",
      detail: reason === "timeout" ? "Time ran out, but the opponent could not checkmate." : `Drawn by ${REASON[reason]}.`,
      tone: "draw",
      badge: "Game drawn",
    };
  }
  const winner: Color = result === "white_win" ? "white" : "black";
  const how = reason === "timeout" ? "on time" : `by ${REASON[reason]}`;
  if (!myColor) {
    return { title: `${winner === "white" ? "White" : "Black"} wins`, detail: `Won ${how}.`, tone: "win", badge: "Game over" };
  }
  return winner === myColor
    ? { title: "You won!", detail: `Won ${how}.`, tone: "win", badge: "Victory" }
    : { title: "You lost", detail: `Lost ${how}. Good game — keep practising!`, tone: "loss", badge: "Defeat" };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function GameOverDialog({ match, myColor, onClose }: { match: MatchView; myColor: Color | null; onClose: () => void }) {
  const mm = useMatchmaking(match.tournament.id);
  if (!match.result || !match.endReason) return null;
  const r = describeResult(match.result, match.endReason, myColor);
  const isPlayer = !!myColor;
  const score = match.result === "white_win" ? ["1", "0"] : match.result === "black_win" ? ["0", "1"] : ["½", "½"];
  const fullMoves = Math.ceil(match.ply / 2);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="overflow-visible bg-[#fdfaf4] p-0 sm:max-w-xl">
        {/* tournament pill */}
        <span className="absolute -top-3 left-1/2 inline-flex max-w-[90%] -translate-x-1/2 items-center gap-1.5 truncate rounded-full bg-primary px-4 py-1 font-mono text-[11px] font-semibold tracking-[0.16em] text-white uppercase">
          <Shield className="size-3.5 shrink-0" /> {match.tournament.name}
        </span>

        <div className="flex flex-col items-center px-6 pt-10 pb-6 text-center sm:px-10">
          <div className="relative">
            <span
              className={cn(
                "flex size-28 items-center justify-center rounded-full",
                r.tone === "win" ? "bg-orange-100" : r.tone === "draw" ? "bg-sky-100" : "bg-[#ece6da]",
              )}
            >
              <span className="flex size-20 items-center justify-center rounded-full bg-white shadow-md">
                {r.tone === "draw" ? (
                  <Handshake className="size-9 text-sky-700" />
                ) : (
                  <Trophy className={cn("size-9", r.tone === "win" ? "text-[#b4510d]" : "text-muted-foreground")} />
                )}
              </span>
            </span>
            {r.tone === "win" && (
              <>
                <Sparkles className="absolute -top-1 right-0 size-6 text-brand-orange" />
                <span className="absolute bottom-2 -left-2 flex size-6 items-center justify-center rounded-full border-2 border-brand-orange text-[10px] text-brand-orange">
                  ★
                </span>
              </>
            )}
          </div>

          <span
            className={cn(
              "mt-4 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] uppercase",
              r.tone === "win" ? "bg-orange-100 text-[#b4510d]" : r.tone === "draw" ? "bg-sky-100 text-sky-800" : "bg-[#ece6da] text-muted-foreground",
            )}
          >
            {r.badge}
          </span>
          <DialogTitle className="mt-2 text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">
            {r.title} {r.tone === "win" && "🎉"}
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-sm text-muted-foreground">
            {r.detail} The result has been added to the tournament leaderboard.
          </DialogDescription>

          {/* score card */}
          <div className="mt-6 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-[#f1ece2] px-4 py-4">
            <div className="flex min-w-0 items-center gap-2.5 text-left">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
                {initials(match.white.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-primary">{match.white.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">White{myColor === "white" && " · you"}</span>
              </span>
            </div>
            <div className="text-center">
              <p className="font-mono text-2xl font-bold text-primary">
                {score[0]} – {score[1]}
              </p>
              <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                {fullMoves} move{fullMoves === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex min-w-0 items-center justify-end gap-2.5 text-right">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-primary">{match.black.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">Black{myColor === "black" && " · you"}</span>
              </span>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-bold text-primary">
                {initials(match.black.name)}
              </span>
            </div>
          </div>

          {/* actions */}
          <div className="mt-6 w-full space-y-3">
            {isPlayer &&
              (mm.waiting ? (
                <div className="flex h-12 w-full items-center justify-between rounded-xl bg-primary/10 px-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Loader2 className="size-4 animate-spin" /> Searching for your next opponent…
                  </span>
                  <button type="button" disabled={mm.pending} onClick={mm.cancel} className="text-sm font-medium text-muted-foreground hover:text-red-700">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={mm.pending || !mm.connected}
                  onClick={mm.findOpponent}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-60"
                >
                  <SkipForward className="size-4" /> Find next opponent
                </button>
              ))}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={isPlayer ? `/student/tournaments/${match.tournament.id}` : `/coach/tournaments/${match.tournament.id}`}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f1ece2] px-3 text-sm font-semibold text-primary hover:bg-[#e9e2d5]"
              >
                <BarChart3 className="size-4" /> {isPlayer ? "Leaderboard" : "Back to tournament"}
              </Link>
              <button type="button" onClick={onClose} className="flex h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-[#f1ece2]">
                Review game
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
