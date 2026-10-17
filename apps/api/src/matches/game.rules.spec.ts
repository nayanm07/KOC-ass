import { Chess } from 'chess.js';
import { applyMoveToClock, liveClock, turnFromFen } from './clock';
import {
  canEverMate,
  finalPgn,
  loadGame,
  MoveRejected,
  playMove,
  resignOutcome,
  timeoutOutcome,
} from './game.rules';

const play = (game: Chess, moves: [string, string][]) => {
  let color: 'white' | 'black' = 'white';
  let last;
  for (const [from, to] of moves) {
    last = playMove(game, color, { from, to });
    color = color === 'white' ? 'black' : 'white';
  }
  return last!;
};

const rejection = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof MoveRejected ? e.code : 'OTHER';
  }
  return null;
};

describe('game rules — move & turn validation', () => {
  it('accepts a legal move by the side to move', () => {
    const m = playMove(new Chess(), 'white', { from: 'e2', to: 'e4' });
    expect(m.san).toBe('e4');
    expect(turnFromFen(m.fen)).toBe('black');
    expect(m.outcome).toBeNull();
  });

  it('rejects a move when it is not your turn', () => {
    expect(rejection(() => playMove(new Chess(), 'black', { from: 'e7', to: 'e5' }))).toBe('NOT_YOUR_TURN');
  });

  it('rejects an illegal move', () => {
    expect(rejection(() => playMove(new Chess(), 'white', { from: 'e2', to: 'e5' }))).toBe('ILLEGAL_MOVE');
  });

  it("rejects moving the opponent's piece", () => {
    expect(rejection(() => playMove(new Chess(), 'white', { from: 'e7', to: 'e5' }))).toBe('ILLEGAL_MOVE');
  });

  it('rejects any move once the game is over', () => {
    const game = new Chess();
    play(game, [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]); // fool's mate
    expect(rejection(() => playMove(game, 'white', { from: 'a2', to: 'a3' }))).toBe('GAME_OVER');
  });

  it('handles promotion', () => {
    const game = new Chess('8/P7/8/8/8/8/8/k6K w - - 0 1');
    const m = playMove(game, 'white', { from: 'a7', to: 'a8', promotion: 'n' });
    expect(m.san).toBe('a8=N');
  });
});

describe('game rules — how games end', () => {
  it("detects checkmate and credits the mover (fool's mate → black wins)", () => {
    const m = play(new Chess(), [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]);
    expect(m.outcome).toEqual({ result: 'black_win', reason: 'checkmate' });
    expect(m.pgn).toContain('0-1');
  });

  it('detects stalemate as a draw', () => {
    // Qb6-c7 leaves the black king on a8 with no legal move and not in check
    const game = new Chess('k7/8/1Q6/8/8/8/8/7K w - - 0 1');
    expect(playMove(game, 'white', { from: 'b6', to: 'c7' }).outcome).toEqual({ result: 'draw', reason: 'stalemate' });
  });

  it('detects insufficient material', () => {
    const game = new Chess('k7/8/8/8/8/8/1r6/K7 w - - 0 1');
    expect(playMove(game, 'white', { from: 'a1', to: 'b2' }).outcome).toEqual({
      result: 'draw',
      reason: 'insufficient_material',
    });
  });

  it('detects threefold repetition (needs full history → rebuilt from PGN)', () => {
    const game = new Chess();
    const shuffle: [string, string][] = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
    play(game, shuffle);
    const reloaded = loadGame(game.pgn()); // as the server does on every move
    play(reloaded, shuffle.slice(0, 3));
    const m = playMove(reloaded, 'black', { from: 'f6', to: 'g8' });
    expect(m.outcome).toEqual({ result: 'draw', reason: 'threefold_repetition' });
  });

  it('resignation: the opponent wins', () => {
    expect(resignOutcome('white')).toEqual({ result: 'black_win', reason: 'resignation' });
    expect(resignOutcome('black')).toEqual({ result: 'white_win', reason: 'resignation' });
  });

  it('timeout: the flagged player loses…', () => {
    const start = new Chess().fen();
    expect(timeoutOutcome(start, 'white')).toEqual({ result: 'black_win', reason: 'timeout' });
  });

  it('…unless the opponent could never mate (lone king) → draw', () => {
    const fen = 'k7/8/8/8/8/8/1Q6/K7 b - - 0 1'; // black has only a king
    expect(canEverMate(fen, 'black')).toBe(false);
    expect(timeoutOutcome(fen, 'white')).toEqual({ result: 'draw', reason: 'timeout' });
  });

  it('writes the result into the final PGN', () => {
    const game = new Chess();
    play(game, [['e2', 'e4'], ['e7', 'e5']]);
    expect(finalPgn(game.pgn(), { White: 'A', Black: 'B' }, 'white_win')).toMatch(/1\. e4 e5 1-0$/);
  });
});

describe('server clock', () => {
  const t0 = new Date('2026-01-01T00:00:00Z');
  const at = (ms: number) => new Date(t0.getTime() + ms);
  const state = { whiteTimeMs: 60_000, blackTimeMs: 60_000, turnStartedAt: t0 };

  it('only the side to move loses time', () => {
    expect(liveClock(state, 'white', true, at(5_000))).toEqual({ whiteMs: 55_000, blackMs: 60_000, running: 'white' });
  });

  it('stops when the game is over', () => {
    expect(liveClock(state, 'white', false, at(5_000)).running).toBeNull();
  });

  it('charges think time and adds the increment', () => {
    const r = applyMoveToClock(state, 'white', 2_000, at(10_000));
    expect(r).toMatchObject({ whiteTimeMs: 52_000, blackTimeMs: 60_000, thinkTimeMs: 10_000, flagged: false });
  });

  it('flags a move made after time ran out', () => {
    expect(applyMoveToClock(state, 'white', 2_000, at(60_001)).flagged).toBe(true);
  });
});
