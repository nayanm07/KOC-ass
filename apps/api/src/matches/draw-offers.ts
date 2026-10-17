import { Injectable } from '@nestjs/common';
import type { Color } from './clock';

/**
 * Pending draw offers, in memory: matchId → colour that offered.
 * Ephemeral by design — any move cancels an offer, and losing one on restart only means
 * the player has to offer again. (Documented trade-off; a multi-instance setup would use Redis.)
 */
@Injectable()
export class DrawOffers {
  private readonly offers = new Map<string, Color>();

  get(matchId: string): Color | null {
    return this.offers.get(matchId) ?? null;
  }

  set(matchId: string, by: Color) {
    this.offers.set(matchId, by);
  }

  clear(matchId: string) {
    this.offers.delete(matchId);
  }
}
