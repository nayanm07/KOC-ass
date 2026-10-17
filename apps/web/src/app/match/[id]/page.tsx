"use client";

import { Chess, type Square } from "chess.js";
import { ArrowLeft, Flag, Handshake, RefreshCw, WifiOff } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { describeResult, GameOverDialog } from "@/components/match/game-over-dialog";
import { MoveList, type HistoryMove } from "@/components/match/move-list";
import { PlayerBar } from "@/components/match/player-bar";
import { PromotionDialog } from "@/components/match/promotion-dialog";
import { ErrorState, LoadingState } from "@/components/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLiveMatch, type Promotion } from "@/hooks/use-live-match";
import type { Color, MatchView } from "@/lib/types";

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

function StatusLine({ match, myColor, isMyTurn, pending }: { match: MatchView; myColor: Color | null; isMyTurn: boolean; pending: boolean }) {
  if (match.status === "completed" && match.result && match.endReason) {
    const r = describeResult(match.result, match.endReason, myColor);
    return (
      <p className="font-medium">
        {r.title} <span className="font-normal text-muted-foreground">— {r.detail}</span>
      </p>
    );
  }
  if (!myColor) return <p className="text-muted-foreground">Spectating · {match.turn === "white" ? "White" : "Black"} to move</p>;
  if (pending) return <p className="text-muted-foreground">Sending move…</p>;
  return isMyTurn ? (
    <p className="font-medium text-brand-orange">Your turn</p>
  ) : (
    <p className="text-muted-foreground">Waiting for your opponent…</p>
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

  const bar = (c: Color) => (
    <PlayerBar
      name={player(c).name}
      color={c}
      isYou={myColor === c}
      ms={clockFor(c)}
      running={m.clock.running === c}
      receivedAt={g.receivedAt}
      toMove={ongoing && m.turn === c}
    />
  );

  return (
    <div className="space-y-4">
      <Link
        href={myColor ? `/student/tournaments/${m.tournament.id}` : `/coach/tournaments/${m.tournament.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> {m.tournament.name}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mx-auto w-full max-w-[min(78vh,640px)] space-y-2">
          {bar(top)}
          <div className={!live ? "rounded-md ring-4 ring-brand-orange/60" : undefined}>
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
          {bar(bottom)}
          {!live && (
            <p className="text-center text-sm text-brand-orange">
              Reviewing move {viewPly} —{" "}
              <button type="button" className="underline" onClick={() => setViewPly(null)}>
                back to live
              </button>
            </p>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-1 text-sm">
              <StatusLine match={m} myColor={myColor} isMyTurn={g.isMyTurn} pending={g.pending} />
              <p className="text-muted-foreground">
                {m.timeControl.label} · {m.white.name} vs {m.black.name}
              </p>
            </CardContent>
          </Card>

          {!g.connected && ongoing && (
            <Alert variant="destructive">
              <WifiOff />
              <AlertDescription>Connection lost — reconnecting. Your clock keeps running on the server.</AlertDescription>
            </Alert>
          )}

          {ongoing && offerFromOpponent && (
            <Alert>
              <Handshake />
              <AlertDescription className="flex flex-wrap items-center gap-2">
                Your opponent offers a draw.
                <Button size="sm" onClick={() => g.respondDraw(true)}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => g.respondDraw(false)}>
                  Decline
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <MoveList moves={history} pgn={m.pgn} viewPly={viewPly} onViewPly={setViewPly} />

          <div className="flex flex-wrap gap-2">
            {myColor && ongoing && (
              <>
                <Button variant="outline" size="sm" disabled={offerFromMe || !g.connected} onClick={() => g.offerDraw()}>
                  <Handshake /> {offerFromMe ? "Draw offered" : "Offer draw"}
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" disabled={!g.connected} onClick={() => setConfirmResign(true)}>
                  <Flag /> Resign
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => setFlipped((f) => !f)}>
              <RefreshCw /> Flip board
            </Button>
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
