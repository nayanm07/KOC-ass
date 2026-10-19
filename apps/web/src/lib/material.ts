/**
 * Captured pieces + material balance from a FEN — pure, no engine.
 * Values: pawn 1, knight 3, bishop 3, rook 5, queen 9 (the standard teaching scale).
 */

type PieceType = "p" | "n" | "b" | "r" | "q";

const START: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const ORDER: PieceType[] = ["q", "r", "b", "n", "p"];
const GLYPH: Record<"w" | "b", Record<PieceType, string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" },
};

export interface MaterialInfo {
  /** Glyphs of the opponent's pieces each side has captured (most valuable first) */
  capturedBy: { white: string[]; black: string[] };
  /** White material minus black material, in pawns */
  diff: number;
}

export function materialFromFen(fen: string): MaterialInfo {
  const board = fen.split(" ")[0] ?? "";
  const count = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const ch of board) {
    const lower = ch.toLowerCase() as PieceType;
    if (!(lower in START)) continue;
    count[ch === lower ? "b" : "w"][lower]++;
  }

  const captured = (side: "w" | "b") =>
    // pieces of `side` that are missing from the board (promotions can make this negative → 0)
    ORDER.flatMap((t) => Array(Math.max(0, START[t] - count[side][t])).fill(GLYPH[side][t]) as string[]);
  const material = (side: "w" | "b") => ORDER.reduce((sum, t) => sum + count[side][t] * VALUE[t], 0);

  return {
    capturedBy: { white: captured("b"), black: captured("w") },
    diff: material("w") - material("b"),
  };
}
