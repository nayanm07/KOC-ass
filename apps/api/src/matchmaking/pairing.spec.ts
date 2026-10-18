import { assignColors, pairKey, pickPair, type QueueEntry } from './pairing';

const entry = (id: string, userId: string, secondsAgo: number): QueueEntry => ({
  id,
  userId,
  enqueuedAt: new Date(Date.now() - secondsAgo * 1000),
});
const users = (pair: [QueueEntry, QueueEntry] | null) => pair?.map((e) => e.userId);

describe('pairing', () => {
  describe('pickPair — basics', () => {
    it('returns null with nobody or one player waiting', () => {
      expect(pickPair([])).toBeNull();
      expect(pickPair([entry('1', 'alice', 5)])).toBeNull();
    });

    it('without standings or history it is FIFO', () => {
      const pair = pickPair([entry('1', 'carol', 1), entry('2', 'alice', 30), entry('3', 'bob', 10)]);
      expect(users(pair)).toEqual(['alice', 'bob']);
    });

    it('never pairs a player with themselves', () => {
      expect(pickPair([entry('1', 'alice', 10), entry('2', 'alice', 5)])).toBeNull();
    });
  });

  describe('pickPair — standings-based', () => {
    const queue = [entry('1', 'anchor', 60), entry('2', 'far', 50), entry('3', 'close', 5)];

    it('pairs the longest-waiting player with the closest-ranked one, not the next in line', () => {
      const halfPoints = new Map([
        ['anchor', 6], // 3 pts
        ['far', 0], // 0 pts — waited longer
        ['close', 5], // 2.5 pts
      ]);
      expect(users(pickPair(queue, { halfPoints }))).toEqual(['anchor', 'close']);
    });

    it('breaks equal point gaps by waiting time', () => {
      const halfPoints = new Map([
        ['anchor', 2],
        ['far', 0],
        ['close', 4],
      ]);
      expect(users(pickPair(queue, { halfPoints }))).toEqual(['anchor', 'far']);
    });

    it('arena: prefers a new opponent over a closer-ranked rematch', () => {
      const halfPoints = new Map([
        ['anchor', 6],
        ['far', 0],
        ['close', 6],
      ]);
      const played = new Set([pairKey('anchor', 'close')]);
      expect(users(pickPair(queue, { halfPoints, played }))).toEqual(['anchor', 'far']);
    });

    it('arena: still allows a rematch when it is the only option', () => {
      const q = [entry('1', 'a', 10), entry('2', 'b', 5)];
      expect(users(pickPair(q, { played: new Set([pairKey('a', 'b')]) }))).toEqual(['a', 'b']);
    });
  });

  describe('pickPair — round robin', () => {
    it('never repeats a pairing', () => {
      const q = [entry('1', 'a', 10), entry('2', 'b', 5)];
      expect(pickPair(q, { played: new Set([pairKey('a', 'b')]), roundRobin: true })).toBeNull();
    });

    it('a blocked anchor does not block others: next-longest waiter is paired instead', () => {
      // a has played b and c; b and c haven't played each other
      const q = [entry('1', 'a', 30), entry('2', 'b', 20), entry('3', 'c', 10)];
      const played = new Set([pairKey('a', 'b'), pairKey('a', 'c')]);
      expect(users(pickPair(q, { played, roundRobin: true }))).toEqual(['b', 'c']);
    });

    it('pairKey is order-independent', () => {
      expect(pairKey('x', 'y')).toBe(pairKey('y', 'x'));
    });
  });

  describe('assignColors', () => {
    it('gives white to the first player when random < 0.5', () => {
      expect(assignColors('a', 'b', () => 0.1)).toEqual({ whiteId: 'a', blackId: 'b' });
    });

    it('gives white to the second player when random >= 0.5', () => {
      expect(assignColors('a', 'b', () => 0.9)).toEqual({ whiteId: 'b', blackId: 'a' });
    });

    it('always assigns two different players', () => {
      for (let i = 0; i < 20; i++) {
        const { whiteId, blackId } = assignColors('a', 'b');
        expect(new Set([whiteId, blackId])).toEqual(new Set(['a', 'b']));
      }
    });
  });
});
