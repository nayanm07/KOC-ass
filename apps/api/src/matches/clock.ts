/**
 * Server-side chess clock maths — pure functions, no I/O.
 *
 * Stored per match: whiteTimeMs, blackTimeMs = time left at the START of the current turn,
 * plus turnStartedAt. Only the side to move is running, so:
 *   live remaining (side to move) = stored − (now − turnStartedAt)
 */

export type Color = 'white' | 'black';

export function turnFromFen(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

export const opposite = (c: Color): Color => (c === 'white' ? 'black' : 'white');

export interface ClockState {
  whiteTimeMs: number;
  blackTimeMs: number;
  turnStartedAt: Date | null;
}

export interface LiveClock {
  whiteMs: number;
  blackMs: number;
  /** Whose clock is ticking, or null when the game is over */
  running: Color | null;
}

export function liveClock(state: ClockState, turn: Color, isLive: boolean, now: Date): LiveClock {
  if (!isLive || !state.turnStartedAt) {
    return { whiteMs: state.whiteTimeMs, blackMs: state.blackTimeMs, running: null };
  }
  const elapsed = Math.max(0, now.getTime() - state.turnStartedAt.getTime());
  return {
    whiteMs: turn === 'white' ? Math.max(0, state.whiteTimeMs - elapsed) : state.whiteTimeMs,
    blackMs: turn === 'black' ? Math.max(0, state.blackTimeMs - elapsed) : state.blackTimeMs,
    running: turn,
  };
}

/**
 * Apply a move made by `mover` at `now`: charge the elapsed time, then add the increment.
 * Returns the new stored clocks (the opponent's clock starts at `now`), and whether the mover flagged.
 */
export function applyMoveToClock(
  state: ClockState,
  mover: Color,
  incrementMs: number,
  now: Date,
): { whiteTimeMs: number; blackTimeMs: number; thinkTimeMs: number; flagged: boolean } {
  const started = state.turnStartedAt ?? now;
  const thinkTimeMs = Math.max(0, now.getTime() - started.getTime());
  const before = mover === 'white' ? state.whiteTimeMs : state.blackTimeMs;
  const left = before - thinkTimeMs;
  if (left <= 0) {
    return { whiteTimeMs: state.whiteTimeMs, blackTimeMs: state.blackTimeMs, thinkTimeMs, flagged: true };
  }
  const after = left + incrementMs;
  return {
    whiteTimeMs: mover === 'white' ? after : state.whiteTimeMs,
    blackTimeMs: mover === 'black' ? after : state.blackTimeMs,
    thinkTimeMs,
    flagged: false,
  };
}
