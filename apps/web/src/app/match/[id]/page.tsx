"use client";

import { Chess, type Square } from "chess.js";
import { ArrowLeft, CalendarDays, Eye, Flag, Handshake, RefreshCw, Timer, WifiOff } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { describeResult, GameOverDialog } from "@/components/match/game-over-dialog";
import { MoveList, type HistoryMove } from "@/components/match/move-list";
import { PlayerCard } from "@/components/match/player-card";
import { PromotionDialog } from "@/components/match/promotion-dialog";
import { ErrorState, LoadingState } from "@/components/states";
import { speedCategory } from "@/components/tournaments/tournament-form-dialog";
import { useLiveMatch, type Promotion } from "@/hooks/use-live-match";
import { formatDateTime } from "@/lib/format";
import { materialFromFen } from "@/lib/material";
import type { Color, MatchView } from "@/lib/types";
import { cn } from "@/lib/utils";

const START_FEN = new Chess().fen();
const LAST_MOVE = { background: "rgba(244, 123, 32, 0.35)" };
const SELECTED = { background: "rgba(11, 58, 99, 0.35)" };
const TARGET = { background: "radial-gradient(circle, rgba(11,58,99,0.45) 22%, transparent 24%)" };
const CAPTURE = { background: "radial-gradient(circle, transparent 58%, rgba(11,58,99,0.45) 60%)" };
const CHECK = { background: "radial-gradient(circle, rgba(220,38,38,0.85) 25%, rgba(220,38,38,0.25) 70%)" };

function kingSquare(chess: Chess, color: "w" | "b"): string | null {
  for (const row of chess.board()) for (const p of row) if (p && p.type === "k" && p.color === color) return p.square;
  return null;
}

function useHistory(pgn: string): HistoryMove[] {
  return useMemo(() => {
    const c = new Chess();
    if (pgn) {
      try {
        c.loadPgn(pgn);
      } catch {
        return [];
      }
    }
    return c.history({ verbose: true }).map((m) => ({ san: m.san, after: m.after, from: m.from, to: m.to }));
  }, [pgn]);
}

/** Status pill text + tone for the sidebar card */
function statusPill(m: MatchView, myColor: Color | null, isMyTurn: boolean, pending: boolean) {
  const move = Math.floor(m.ply / 2) + 1;
  if (m.status === "completed" && m.result && m.endReason) {
    const r = describeResult(m.result, m.endReason, myColor);
    return { text: `${r.title} · ${r.detail.replace(/\.$/, "")}`, cls: "bg-amber-100 text-amber-900" };
  }
  if (!myColor) return { text: `Spectating · Move ${move}`, cls: "bg-sky-50 text-sky-800" };
  if (pending) return { text: `Sending move…`, cls: "bg-[#f1ece2] text-muted-foreground" };
  return isMyTurn
    ? { text: `Your turn · Move ${move}`, cls: "bg-orange-100 text-[#b4510d]" }
    : { text: `Opponent’s turn · Move ${move}`, cls: "bg-[#f1ece2] text-muted-foreground" };
}

function MaterialBar({ diff }: { diff: number }) {
  // White's share of the bar: 50% when level, ±5% per pawn, capped
  const white = 50 + Math.max(-45, Math.min(45, diff * 5));
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-xs">
        <span className="font-semibold text-primary">
          Material: {diff === 0 ? "even" : `${diff > 0 ? "White" : "Black"} +${Math.abs(diff)}`}
        </span>
        <span className="text-muted-foreground">{diff === 0 ? "Level" : diff > 0 ? "White ahead" : "Black ahead"}</span>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full border border-primary/20 bg-primary">
        <span className="bg-white transition-all duration-500" style={{ width: `${white}%` }} />
      </div>
    </div>
  );
}

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const g = useLiveMatch(id);
  const history = useHistory(g.match?.pgn ?? "");

  const [viewPly, setViewPly] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const live = viewPly === null;
  const boardFen = live ? (g.displayFen ?? START_FEN) : viewPly === 0 ? START_FEN : (history[viewPly - 1]?.after ?? START_FEN);
  const interactive = live && g.isMyTurn && g.connected;
  const position = useMemo(() => new Chess(boardFen), [boardFen]);
  const material = useMemo(() => materialFromFen(boardFen), [boardFen]);

  const targets = useMemo(() => {
    if (!selected || !interactive) return [] as { to: string; capture: boolean }[];
    return position
      .moves({ square: selected as Square, verbose: true })
      .map((m) => ({ to: m.to, capture: !!m.captured }));
  }, [selected, interactive, position]);

  if (g.initial.isPending && !g.match) return <LoadingState label="Loading game…" />;
  if (g.initial.isError && !g.match) return <ErrorState error={g.initial.error} onRetry={() => g.initial.refetch()} />;
  if (!g.match) return <LoadingState label="Joining game…" />;

  const m = g.match;
  const myColor = g.myColor;
  const myPrefix = myColor === "white" ? "w" : "b";
  const orientation: Color = myColor ? (flipped ? (myColor === "white" ? "black" : "white") : myColor) : flipped ? "black" : "white";
  const top: Color = orientation === "white" ? "black" : "white";
  const bottom: Color = orientation;

  const tryMove = (from: string, to: string, pieceType: string): boolean => {
    setSelected(null);
    const isPawn = pieceType[1] === "P";
    if (isPawn && ((pieceType[0] === "w" && to[1] === "8") || (pieceType[0] === "b" && to[1] === "1"))) {
      const legal = position.moves({ square: from as Square, verbose: true }).some((mv) => mv.to === to);
      if (legal) setPromotion({ from, to });
      return false; // wait for the piece choice
    }
    return g.move(from, to);
  };

  // Highlights
  const styles: Record<string, React.CSSProperties> = {};
  const lastMove = live ? m.lastMove : viewPly ? history[viewPly - 1] : null;
  if (lastMove) {
    styles[lastMove.from] = LAST_MOVE;
    styles[lastMove.to] = LAST_MOVE;
  }
  if (position.inCheck()) {
    const k = kingSquare(position, position.turn());
    if (k) styles[k] = CHECK;
  }
  if (selected) styles[selected] = SELECTED;
  for (const t of targets) styles[t.to] = { ...styles[t.to], ...(t.capture ? CAPTURE : TARGET) };

  const clockFor = (c: Color) => (c === "white" ? m.clock.whiteMs : m.clock.blackMs);
  const player = (c: Color) => (c === "white" ? m.white : m.black);
  const offerFromOpponent = !!myColor && m.drawOffer && m.drawOffer !== myColor;
  const offerFromMe = !!myColor && m.drawOffer === myColor;
  const ongoing = m.status === "ongoing";
  const pill = statusPill(m, myColor, g.isMyTurn, g.pending);
  const tournamentHref = myColor ? `/student/tournaments/${m.tournament.id}` : `/coach/tournaments/${m.tournament.id}`;

  const card = (c: Color) => (
    <PlayerCard
      name={player(c).name}
      color={c}
      isYou={myColor === c}
      ms={clockFor(c)}
      running={m.clock.running === c}
      receivedAt={g.receivedAt}
      toMove={m.turn === c}
      live={ongoing}
      captured={c === "white" ? material.capturedBy.white : material.capturedBy.black}
      lead={c === "white" ? material.diff : -material.diff}
    />
  );

  const tile =
    "flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card text-sm font-semibold shadow-sm transition hover:shadow-md disabled:opacity-50 disabled:hover:shadow-sm";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        {/* Board column */}
        {/* Board column sized from the viewport height so both clocks are always visible without scrolling */}
        <div className="mx-auto w-full max-w-[max(300px,min(calc(100dvh_-_19.5rem),720px))] min-w-0 space-y-3">
          {card(top)}
          <div className={cn("rounded-2xl border bg-card p-2 shadow-sm sm:p-3", !live && "ring-4 ring-brand-orange/50")}>
            <div className="overflow-hidden rounded-xl">
              <Chessboard
                options={{
                  id: `match-${m.id}`,
                  position: boardFen,
                  boardOrientation: orientation,
                  allowDragging: interactive,
                  squareStyles: styles,
                  darkSquareStyle: { backgroundColor: "#7c9cb8" },
                  lightSquareStyle: { backgroundColor: "#eef1e6" },
                  animationDurationInMs: 150,
                  canDragPiece: ({ piece }) => interactive && piece.pieceType[0] === myPrefix,
                  onPieceDrop: ({ piece, sourceSquare, targetSquare }) =>
                    !!targetSquare && tryMove(sourceSquare, targetSquare, piece.pieceType),
                  onSquareClick: ({ piece, square }) => {
                    if (!interactive) return;
                    if (selected && targets.some((t) => t.to === square)) {
                      const moving = position.get(selected as Square);
                      if (moving) tryMove(selected, square, `${moving.color}${moving.type.toUpperCase()}`);
                      return;
                    }
                    setSelected(piece && piece.pieceType[0] === myPrefix && square !== selected ? square : null);
                  },
                }}
              />
            </div>
          </div>
          {card(bottom)}
          {!live && (
            <p className="text-center text-sm text-brand-orange">
              Reviewing move {viewPly} —{" "}
              <button type="button" className="font-semibold underline" onClick={() => setViewPly(null)}>
                back to live
              </button>
            </p>
          )}
        </div>

        {/* Sidebar */}
        <aside className="min-w-0 space-y-4">
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <Link href={tournamentHref} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary">
              <ArrowLeft className="size-4" /> Back to tournament
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] uppercase", pill.cls)}>
                {pill.text}
              </span>
              {!myColor && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-sky-800">
                  <Eye className="size-3.5" /> Spectating
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-primary">
              {m.tournament.name} <span className="font-mono text-lg text-muted-foreground">{m.timeControl.label}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {m.white.name} (white) vs {m.black.name} (black)
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Timer className="size-3.5 text-brand-orange" />
                {speedCategory(m.timeControl.baseSeconds / 60, m.timeControl.incrementSeconds)}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" /> Started {formatDateTime(m.startedAt)}
              </span>
            </p>
            <div className="mt-4">
              <MaterialBar diff={material.diff} />
            </div>

            {!g.connected && ongoing && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                <WifiOff className="mt-0.5 size-4 shrink-0" />
                Connection lost — reconnecting. Your clock keeps running on the server.
              </p>
            )}
            {ongoing && offerFromOpponent && (
              <div className="mt-4 rounded-xl bg-orange-50 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Handshake className="size-4 text-brand-orange" /> Your opponent offers a draw
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => g.respondDraw(true)} className="h-9 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                    Accept
                  </button>
                  <button type="button" onClick={() => g.respondDraw(false)} className="h-9 flex-1 rounded-lg bg-white text-sm font-semibold text-primary hover:bg-accent">
                    Decline
                  </button>
                </div>
              </div>
            )}
            {ongoing && offerFromMe && <p className="mt-4 rounded-xl bg-[#f6f2ea] p-3 text-sm text-muted-foreground">Draw offered — waiting for your opponent…</p>}
          </section>

          <MoveList moves={history} pgn={m.pgn} viewPly={viewPly} onViewPly={setViewPly} />

          <div className={cn("grid gap-3", myColor && ongoing ? "grid-cols-3" : "grid-cols-1")}>
            {myColor && ongoing && (
              <>
                <button type="button" className={cn(tile, "text-primary")} disabled={offerFromMe || !g.connected} onClick={() => g.offerDraw()}>
                  <Handshake className="size-5" />
                  {offerFromMe ? "Offered" : "Offer draw"}
                </button>
                <button type="button" className={cn(tile, "text-red-600")} disabled={!g.connected} onClick={() => setConfirmResign(true)}>
                  <Flag className="size-5" />
                  Resign
                </button>
              </>
            )}
            <button type="button" className={cn(tile, "text-primary")} onClick={() => setFlipped((f) => !f)}>
              <RefreshCw className="size-5" />
              Flip board
            </button>
          </div>
        </aside>
      </div>

      {promotion && myColor && (
        <PromotionDialog
          color={myColor}
          onCancel={() => setPromotion(null)}
          onPick={(p: Promotion) => {
            g.move(promotion.from, promotion.to, p);
            setPromotion(null);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmResign}
        onOpenChange={setConfirmResign}
        title="Resign this game?"
        description="Your opponent will be awarded the win."
        confirmLabel="Resign"
        destructive
        onConfirm={() => {
          setConfirmResign(false);
          void g.resign();
        }}
      />

      {g.ended && m.status === "completed" && <GameOverDialog match={m} myColor={myColor} onClose={g.dismissEnded} />}
    </div>
  );
}
