/**
 * Pure pairing logic. Matchmaking is FIFO: the two players who have waited longest are paired,
 * and colours are assigned at random so nobody is always white.
 */

export interface QueueEntry {
  id: string;
  userId: string;
  enqueuedAt: Date;
}

/** Oldest two distinct players, or null if fewer than two are waiting */
export function pickPair(queue: QueueEntry[]): [QueueEntry, QueueEntry] | null {
  const sorted = [...queue].sort(
    (a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime() || a.id.localeCompare(b.id),
  );
  const first = sorted[0];
  const second = sorted.find((e) => first && e.userId !== first.userId);
  return first && second ? [first, second] : null;
}

/** `random` is injectable so tests are deterministic */
export function assignColors(
  a: string,
  b: string,
  random: () => number = Math.random,
): { whiteId: string; blackId: string } {
  return random() < 0.5 ? { whiteId: a, blackId: b } : { whiteId: b, blackId: a };
}
