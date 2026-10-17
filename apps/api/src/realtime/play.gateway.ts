import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { AUTH_COOKIE, type AuthUser } from '../auth/auth.types';
import { QueueJoinDto } from '../matchmaking/dto/queue.dto';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { ClientEvents, ServerEvents, userRoom } from './events';
import { RealtimeService } from './realtime.service';
import { parseCookies, parsePayload, respond, WsAppError } from './ws-utils';

type AuthedSocket = Socket & { data: { user: AuthUser } };

/**
 * One Socket.IO gateway for all live features. Every connection is authenticated in the
 * handshake with the same httpOnly JWT cookie used by REST — unauthenticated sockets never connect.
 */
@WebSocketGateway()
export class PlayGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PlayGateway.name);

  constructor(
    private readonly auth: AuthService,
    private readonly realtime: RealtimeService,
    private readonly matchmaking: MatchmakingService,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
    server.use((socket, next) => {
      const token = parseCookies(socket.handshake.headers.cookie)[AUTH_COOKIE];
      if (!token) return next(new Error('UNAUTHENTICATED'));
      this.auth
        .verifyToken(token)
        .then((user) => {
          (socket as AuthedSocket).data.user = user;
          next();
        })
        .catch(() => next(new Error('UNAUTHENTICATED')));
    });
  }

  async handleConnection(socket: AuthedSocket) {
    const { user } = socket.data;
    await socket.join(userRoom(user.id));
    // Resync a (re)connecting tab with its matchmaking state
    socket.emit(ServerEvents.QueueStatus, await this.matchmaking.statusFor(user.id));
  }

  async handleDisconnect(socket: AuthedSocket) {
    const user = socket.data.user;
    if (!user) return;
    // Only drop them from the queue once their LAST tab is gone
    if ((await this.realtime.userConnectionCount(user.id)) === 0) {
      await this.matchmaking.leaveQueue(user.id, 'disconnected').catch((e: unknown) =>
        this.logger.error(`leaveQueue on disconnect failed: ${String(e)}`),
      );
    }
  }

  @SubscribeMessage(ClientEvents.QueueJoin)
  queueJoin(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    return respond(async () => {
      const user = socket.data.user;
      if (user.role !== 'student') {
        throw new WsAppError({ code: 'FORBIDDEN_ROLE', message: 'Only students can play' });
      }
      const { tournamentId } = await parsePayload(QueueJoinDto, body);
      return this.matchmaking.joinQueue(user, tournamentId);
    });
  }

  @SubscribeMessage(ClientEvents.QueueLeave)
  queueLeave(@ConnectedSocket() socket: AuthedSocket) {
    return respond(() => this.matchmaking.leaveQueue(socket.data.user.id));
  }
}
