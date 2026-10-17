import { assignColors, pickPair, type QueueEntry } from './pairing';

const entry = (id: string, userId: string, secondsAgo: number): QueueEntry => ({
  id,
  userId,
  enqueuedAt: new Date(Date.now() - secondsAgo * 1000),
});

describe('pairing', () => {
  describe('pickPair', () => {
    it('returns null with nobody or one player waiting', () => {
      expect(pickPair([])).toBeNull();
      expect(pickPair([entry('1', 'alice', 5)])).toBeNull();
    });

    it('pairs the two longest-waiting players (FIFO)', () => {
      const pair = pickPair([entry('1', 'carol', 1), entry('2', 'alice', 30), entry('3', 'bob', 10)]);
      expect(pair?.map((e) => e.userId)).toEqual(['alice', 'bob']);
    });

    it('never pairs a player with themselves', () => {
      expect(pickPair([entry('1', 'alice', 10), entry('2', 'alice', 5)])).toBeNull();
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
