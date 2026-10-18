/**
 * Pure pairing logic — standings-based.
 *
 * 1. Fairness: the longest-waiting player is the "anchor" and is always paired first, so nobody
 *    can be starved by others joining the queue after them.
 * 2. The anchor's opponent is the waiting player who is
 *      a) someone they haven't played yet (arena: preferred; round robin: required), then
 *      b) closest in tournament points (standings-based pairing), then
 *      c) waiting longest.
 * 3. Round robin: if the anchor has already played everyone currently waiting, the next-longest
 *    waiting player becomes the anchor instead — one blocked player never blocks everyone else.
 *
 * With no standings / history (everyone on 0, no games) this degrades to plain FIFO.
 * Colours are random so nobody is always white.
 */

export interface QueueEntry {
  id: string;
  userId: string;
  enqueuedAt: Date;
}

export interface PairingContext {
  /** Tournament half-points per player (win 2, draw 1); missing = 0 */
  halfPoints?: ReadonlyMap<string, number>;
  /** Pairs that already have a game in this tournament, as `pairKey(a, b)` */
  played?: ReadonlySet<string>;
  /** Round robin: a pair may meet only once */
  roundRobin?: boolean;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function pickPair(queue: QueueEntry[], ctx: PairingContext = {}): [QueueEntry, QueueEntry] | null {
  const pts = (id: string) => ctx.halfPoints?.get(id) ?? 0;
  const hasPlayed = (a: string, b: string) => ctx.played?.has(pairKey(a, b)) ?? false;

  const byWait = [...queue].sort(
    (a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime() || a.id.localeCompare(b.id),
  );

  for (const anchor of byWait) {
    const candidates = byWait.filter(
      (e) => e.userId !== anchor.userId && !(ctx.roundRobin && hasPlayed(anchor.userId, e.userId)),
    );
    if (!candidates.length) continue;

    const best = candidates.reduce((x, y) => {
      const rematch = Number(hasPlayed(anchor.userId, x.userId)) - Number(hasPlayed(anchor.userId, y.userId));
      if (rematch !== 0) return rematch < 0 ? x : y;
      const gap = Math.abs(pts(x.userId) - pts(anchor.userId)) - Math.abs(pts(y.userId) - pts(anchor.userId));
      if (gap !== 0) return gap < 0 ? x : y;
      return x; // byWait order → the one waiting longer
    });
    return [anchor, best];
  }
  return null;
}

/** `random` is injectable so tests are deterministic */
export function assignColors(
  a: string,
  b: string,
  random: () => number = Math.random,
): { whiteId: string; blackId: string } {
  return random() < 0.5 ? { whiteId: a, blackId: b } : { whiteId: b, blackId: a };
}
