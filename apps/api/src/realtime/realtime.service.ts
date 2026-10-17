import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import { matchRoom, userRoom } from './events';

/**
 * Thin wrapper around the Socket.IO server so domain services (matchmaking, game) can push
 * events without depending on the gateway (avoids a circular dependency).
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server?: Server;

  attach(server: Server) {
    this.server = server;
  }

  /** Every open tab of this user */
  toUser(userId: string, event: string, payload: unknown) {
    if (!this.server) return this.logger.warn(`Socket server not ready; dropped ${event}`);
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  /** Everyone in a match room (both players + spectators) */
  toMatch(matchId: string, event: string, payload: unknown) {
    if (!this.server) return this.logger.warn(`Socket server not ready; dropped ${event}`);
    this.server.to(matchRoom(matchId)).emit(event, payload);
  }

  /** Several rooms at once — a socket in more than one of them still gets the event once */
  toRooms(rooms: string[], event: string, payload: unknown) {
    if (!this.server) return this.logger.warn(`Socket server not ready; dropped ${event}`);
    this.server.to(rooms).emit(event, payload);
  }

  async userConnectionCount(userId: string): Promise<number> {
    if (!this.server) return 0;
    return (await this.server.in(userRoom(userId)).fetchSockets()).length;
  }
}
