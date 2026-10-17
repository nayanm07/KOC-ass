import { computeStandings, declareWinner, type StandingsGame } from './standings';

const P = (...names: string[]) => names.map((n) => ({ userId: n, name: n }));
const win = (w: string, b: string): StandingsGame => ({ whiteId: w, blackId: b, result: 'white_win' });
const loss = (w: string, b: string): StandingsGame => ({ whiteId: w, blackId: b, result: 'black_win' });
const draw = (w: string, b: string): StandingsGame => ({ whiteId: w, blackId: b, result: 'draw' });
const byName = (rows: ReturnType<typeof computeStandings>) => Object.fromEntries(rows.map((r) => [r.userId, r]));

describe('standings — result → leaderboard scoring', () => {
  it('scores win = 1, draw = ½, loss = 0', () => {
    const s = byName(computeStandings(P('a', 'b', 'c'), [win('a', 'b'), draw('a', 'c'), loss('c', 'b')]));
    expect(s.a).toMatchObject({ points: 1.5, wins: 1, draws: 1, losses: 0, played: 2 });
    expect(s.b).toMatchObject({ points: 1, wins: 1, draws: 0, losses: 1, played: 2 });
    expect(s.c).toMatchObject({ points: 0.5, wins: 0, draws: 1, losses: 1, played: 2 });
  });

  it('credits the right side for white and black wins', () => {
    const s = byName(computeStandings(P('a', 'b'), [loss('a', 'b')]));
    expect(s.b.points).toBe(1);
    expect(s.a.points).toBe(0);
  });

  it('sorts by points', () => {
    const rows = computeStandings(P('a', 'b', 'c'), [win('c', 'a'), win('c', 'b'), win('b', 'a')]);
    expect(rows.map((r) => [r.userId, r.rank, r.points])).toEqual([
      ['c', 1, 2],
      ['b', 2, 1],
      ['a', 3, 0],
    ]);
  });

  it('lists participants with no games at 0 points', () => {
    const rows = computeStandings(P('a', 'b', 'z'), [win('a', 'b')]);
    expect(rows.find((r) => r.userId === 'z')).toMatchObject({ played: 0, points: 0 });
  });

  it('ignores games involving non-participants', () => {
    const rows = computeStandings(P('a', 'b'), [win('a', 'ghost')]);
    expect(rows.every((r) => r.points === 0)).toBe(true);
  });

  it('breaks ties with Sonneborn-Berger (beating stronger opponents ranks higher)', () => {
    // a and d both have 1 point; a beat b (strong: 2 pts), d beat c (weak: 0 pts)
    const games = [win('a', 'b'), win('b', 'c'), win('b', 'd'), win('d', 'c'), win('b', 'e')];
    const rows = computeStandings(P('a', 'b', 'c', 'd', 'e'), games);
    const s = byName(rows);
    expect(s.a.points).toBe(1);
    expect(s.d.points).toBe(1);
    expect(s.a.sonnebornBerger).toBe(3); // beat b who has 3 points
    expect(s.d.sonnebornBerger).toBe(0); // beat c who has 0
    expect(s.a.rank).toBeLessThan(s.d.rank);
  });

  it('counts half of a drawn opponent’s score in Sonneborn-Berger', () => {
    const s = byName(computeStandings(P('a', 'b', 'c'), [draw('a', 'b'), win('b', 'c')]));
    expect(s.a.sonnebornBerger).toBe(0.75); // ½ × b's 1.5
  });

  it('then by number of wins (a win + a loss beats two draws)', () => {
    // x and y both finish on 1.5, so a (beat x, lost to y) and b (drew both) tie on points AND SB
    const games = [win('a', 'x'), loss('a', 'y'), draw('b', 'x'), draw('b', 'y'), win('x', 'z')];
    const s = byName(computeStandings(P('a', 'b', 'x', 'y', 'z'), games));
    expect(s.a.points).toBe(1);
    expect(s.b.points).toBe(1);
    expect(s.a.sonnebornBerger).toBe(1.5);
    expect(s.b.sonnebornBerger).toBe(1.5);
    expect(s.a.rank).toBeLessThan(s.b.rank);
  });

  it('then head-to-head between exactly two tied players', () => {
    // a and b: 1 pt, SB 1, 1 win each — but b beat a, so b ranks above a despite name order
    const games = [win('b', 'a'), loss('b', 'c'), win('a', 'd'), win('d', 'e'), win('c', 'e')];
    const s = byName(computeStandings(P('a', 'b', 'c', 'd', 'e'), games));
    expect([s.a.points, s.a.sonnebornBerger, s.a.wins]).toEqual([1, 1, 1]);
    expect([s.b.points, s.b.sonnebornBerger, s.b.wins]).toEqual([1, 1, 1]);
    expect(s.b.rank).toBeLessThan(s.a.rank);
  });

  it('shares the rank when players are fully tied (1, 1, 3)', () => {
    const rows = computeStandings(P('a', 'b', 'c'), [draw('a', 'b')]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});

describe('declareWinner', () => {
  it('declares the sole first-placed player', () => {
    expect(declareWinner(computeStandings(P('a', 'b'), [win('a', 'b')]))?.userId).toBe('a');
  });

  it('declares nobody when first place is shared', () => {
    expect(declareWinner(computeStandings(P('a', 'b'), [draw('a', 'b')]))).toBeNull();
  });

  it('declares nobody when no games were played', () => {
    expect(declareWinner(computeStandings(P('a', 'b'), []))).toBeNull();
  });
});
