import type { MatchResult } from '../db/schema';

/**
 * Tournament standings — pure function, unit-tested.
 *
 * Scoring: win = 1, draw = ½, loss = 0. Internally everything is counted in HALF-points
 * (integers) so ½ never becomes a floating-point problem.
 *
 * Ranking (tiebreaks in order):
 *   1. points
 *   2. Sonneborn-Berger — sum of the scores of opponents you beat + half the scores of opponents you drew
 *      (rewards results against strong opponents)
 *   3. number of wins
 *   4. head-to-head — only when exactly two players are still level
 * Players still level after all tiebreaks share the rank (standard competition ranking "1, 2, 2, 4").
 * Name is used only to keep the display order stable.
 */

export interface StandingsPlayer {
  userId: string;
  name: string;
}

export interface StandingsGame {
  whiteId: string;
  blackId: string;
  result: MatchResult;
}

export interface StandingRow {
  rank: number;
  userId: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** e.g. 2.5 */
  points: number;
  /** Sonneborn-Berger, e.g. 3.25 */
  sonnebornBerger: number;
}

interface Acc {
  userId: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  half: number; // points × 2
  sbQuarter: number; // SB × 4
}

/** Half-points scored by `userId` in `g` (2 = win, 1 = draw, 0 = loss) */
function halfFor(g: StandingsGame, userId: string): number {
  if (g.result === 'draw') return 1;
  const winner = g.result === 'white_win' ? g.whiteId : g.blackId;
  return winner === userId ? 2 : 0;
}

export function computeStandings(players: StandingsPlayer[], games: StandingsGame[]): StandingRow[] {
  const acc = new Map<string, Acc>(
    players.map((p) => [p.userId, { ...p, played: 0, wins: 0, draws: 0, losses: 0, half: 0, sbQuarter: 0 }]),
  );
  // Only games between registered participants count
  const counted = games.filter((g) => acc.has(g.whiteId) && acc.has(g.blackId));

  for (const g of counted) {
    for (const id of [g.whiteId, g.blackId]) {
      const a = acc.get(id)!;
      const h = halfFor(g, id);
      a.played++;
      a.half += h;
      if (h === 2) a.wins++;
      else if (h === 1) a.draws++;
      else a.losses++;
    }
  }

  // Sonneborn-Berger needs final scores, so it's a second pass
  for (const g of counted) {
    for (const [me, opp] of [
      [g.whiteId, g.blackId],
      [g.blackId, g.whiteId],
    ]) {
      // win: + opponent's half-points × 2 (quarters); draw: + opponent's half-points × 1
      acc.get(me)!.sbQuarter += halfFor(g, me) * acc.get(opp)!.half;
    }
  }

  const headToHead = (a: string, b: string): number => {
    let score = 0; // half-points of a minus b in their mutual games
    for (const g of counted) {
      const pair = (g.whiteId === a && g.blackId === b) || (g.whiteId === b && g.blackId === a);
      if (pair) score += halfFor(g, a) - halfFor(g, b);
    }
    return score;
  };

  const rows = [...acc.values()];
  const primary = (x: Acc, y: Acc) => y.half - x.half || y.sbQuarter - x.sbQuarter || y.wins - x.wins;

  // Head-to-head only decides a tie between exactly two players
  const tiedGroupSize = (x: Acc) => rows.filter((r) => primary(r, x) === 0).length;
  const compare = (x: Acc, y: Acc) => {
    const p = primary(x, y);
    if (p !== 0) return p;
    if (tiedGroupSize(x) === 2) {
      const h2h = headToHead(y.userId, x.userId);
      if (h2h !== 0) return h2h;
    }
    return 0;
  };

  rows.sort((x, y) => compare(x, y) || x.name.localeCompare(y.name));

  return rows.map((r, i) => {
    // Shared rank: same as the first earlier row it is fully tied with
    let rank = i + 1;
    for (let j = i - 1; j >= 0 && compare(rows[j], r) === 0; j--) rank = j + 1;
    return {
      rank,
      userId: r.userId,
      name: r.name,
      played: r.played,
      wins: r.wins,
      draws: r.draws,
      losses: r.losses,
      points: r.half / 2,
      sonnebornBerger: r.sbQuarter / 4,
    };
  });
}

/** The declared winner: the sole player ranked 1st after at least one game; null if shared or no games */
export function declareWinner(rows: StandingRow[]): StandingRow | null {
  const first = rows.filter((r) => r.rank === 1);
  return first.length === 1 && first[0].played > 0 ? first[0] : null;
}
