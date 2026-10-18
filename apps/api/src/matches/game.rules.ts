import { Chess } from 'chess.js';
import type { MatchEndReason, MatchResult } from '../db/schema';
import { opposite, turnFromFen, type Color } from './clock';

/**
 * Pure game rules on top of chess.js — turn order, legality, and how a game ends.
 * The server is the only place moves are applied; clients merely propose them.
 */

export interface MoveInput {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface Outcome {
  result: MatchResult;
  reason: MatchEndReason;
}

export interface AppliedMove {
  san: string;
  from: string;
  to: string;
  promotion: string | null;
  fen: string;
  pgn: string;
  outcome: Outcome | null;
}

export class MoveRejected extends Error {
  constructor(
    public readonly code: 'NOT_YOUR_TURN' | 'ILLEGAL_MOVE' | 'GAME_OVER',
    message: string,
  ) {
    super(message);
  }
}

export const winFor = (c: Color): MatchResult => (c === 'white' ? 'white_win' : 'black_win');

export function pgnResultToken(result: MatchResult | null): string {
  if (result === 'white_win') return '1-0';
  if (result === 'black_win') return '0-1';
  if (result === 'draw') return '1/2-1/2';
  return '*';
}

/** Rebuild the game from its PGN — keeps full history, which threefold repetition needs */
export function loadGame(pgn: string, headers: Record<string, string> = {}): Chess {
  const chess = new Chess();
  if (pgn.trim()) chess.loadPgn(pgn);
  for (const [k, v] of Object.entries(headers)) chess.setHeader(k, v);
  return chess;
}

/** How the game ended after the last move, if it did */
export function detectOutcome(chess: Chess, mover: Color): Outcome | null {
  if (chess.isCheckmate()) return { result: winFor(mover), reason: 'checkmate' };
  if (chess.isStalemate()) return { result: 'draw', reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { result: 'draw', reason: 'insufficient_material' };
  if (chess.isThreefoldRepetition()) return { result: 'draw', reason: 'threefold_repetition' };
  if (chess.isDrawByFiftyMoves()) return { result: 'draw', reason: 'fifty_move_rule' };
  return null;
}

/**
 * Validate + apply a move proposed by `mover`. Throws MoveRejected for anything that isn't
 * this player's legal move in the current position.
 */
export function playMove(game: Chess, mover: Color, move: MoveInput): AppliedMove {
  if (game.isGameOver()) throw new MoveRejected('GAME_OVER', 'The game is already over');
  if (turnFromFen(game.fen()) !== mover) throw new MoveRejected('NOT_YOUR_TURN', "It's not your turn");

  let san: string;
  try {
    san = game.move({ from: move.from, to: move.to, promotion: move.promotion }).san;
  } catch {
    throw new MoveRejected('ILLEGAL_MOVE', `${move.from}→${move.to} is not a legal move`);
  }

  const outcome = detectOutcome(game, mover);
  if (outcome) game.setHeader('Result', pgnResultToken(outcome.result));
  return {
    san,
    from: move.from,
    to: move.to,
    promotion: move.promotion ?? null,
    fen: game.fen(),
    pgn: game.pgn(),
    outcome,
  };
}

/**
 * Could `color` ever deliver mate with the material it has? (FIDE 6.9: if the player who did NOT run
 * out of time cannot possibly checkmate, the game is drawn instead of lost on time.)
 */
export function canEverMate(fen: string, color: Color): boolean {
  const board = fen.split(' ')[0];
  const mine = color === 'white' ? /[PNBRQ]/g : /[pnbrq]/g;
  const pieces = board.match(mine) ?? [];
  if (pieces.some((p) => 'pPrRqQ'.includes(p))) return true;
  return pieces.length >= 2; // two minor pieces can at least construct a mate
}

/** `flagged` ran out of time */
export function timeoutOutcome(fen: string, flagged: Color): Outcome {
  const opponent = opposite(flagged);
  return canEverMate(fen, opponent)
    ? { result: winFor(opponent), reason: 'timeout' }
    : { result: 'draw', reason: 'timeout' };
}

export function resignOutcome(resigning: Color): Outcome {
  return { result: winFor(opposite(resigning)), reason: 'resignation' };
}

/** Final PGN with the result token written in */
export function finalPgn(pgn: string, headers: Record<string, string>, result: MatchResult): string {
  const game = loadGame(pgn, headers);
  game.setHeader('Result', pgnResultToken(result));
  return game.pgn();
}
