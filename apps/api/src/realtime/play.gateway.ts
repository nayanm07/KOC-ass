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
import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { AUTH_COOKIE, type AuthUser } from '../auth/auth.types';
import { DrawResponseDto, MatchRefDto, MoveDto } from '../matches/dto/match.dto';
import { GameService } from '../matches/game.service';
import { QueueJoinDto } from '../matchmaking/dto/queue.dto';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { ClientEvents, matchRoom, ServerEvents, userRoom } from './events';
import { RealtimeService } from './realtime.service';
import { parseCookies, parsePayload, respond, WsAppError } from './ws-utils';

/** socket.data is typed via Socket.IO's SocketData generic (set in the handshake middleware) */
type AuthedSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, { user: AuthUser }>;

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
    private readonly game: GameService,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
    server.use((socket, next) => {
      // Ticket from /auth/socket-ticket (cross-domain deploys), else the session cookie (same site)
      const auth = socket.handshake.auth as { ticket?: unknown } | undefined;
      const ticket = typeof auth?.ticket === 'string' && auth.ticket ? auth.ticket : null;
      const cookie = parseCookies(socket.handshake.headers.cookie)[AUTH_COOKIE];
      if (!ticket && !cookie) return next(new Error('UNAUTHENTICATED'));
      this.auth
        .verifyToken(ticket ?? cookie, ticket ? 'ws' : 'session')
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
      await this.matchmaking
        .leaveQueue(user.id, 'disconnected')
        .catch((e: unknown) => this.logger.error(`leaveQueue on disconnect failed: ${String(e)}`));
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

  /* ── Live match ── */

  /** Only the two players (and coaches, as spectators) may enter a match room */
  @SubscribeMessage(ClientEvents.MatchJoin)
  matchJoin(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    return respond(async () => {
      const { matchId } = await parsePayload(MatchRefDto, body);
      const view = await this.game.viewForJoin(socket.data.user, matchId); // throws if not allowed
      await socket.join(matchRoom(matchId));
      return view;
    });
  }

  @SubscribeMessage(ClientEvents.MatchLeave)
  matchLeave(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    return respond(async () => {
      const { matchId } = await parsePayload(MatchRefDto, body);
      await socket.leave(matchRoom(matchId));
      return { left: true };
    });
  }

  @SubscribeMessage(ClientEvents.MatchMove)
  matchMove(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    return respond(async () => this.game.move(socket.data.user, await parsePayload(MoveDto, body)));
  }

  @SubscribeMessage(ClientEvents.MatchResign)
  matchResign(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    return respond(async () => {
      const { matchId } = await parsePayload(MatchRefDto, body);
      return this.game.resign(socket.data.user, matchId);
    });
  }

  @SubscribeMessage(ClientEvents.MatchOfferDraw)
  matchOfferDraw(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    return respond(async () => {
      const { matchId } = await parsePayload(MatchRefDto, body);
      return this.game.offerDraw(socket.data.user, matchId);
    });
  }

  @SubscribeMessage(ClientEvents.MatchRespondDraw)
  matchRespondDraw(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    return respond(async () => {
      const { matchId, accept } = await parsePayload(DrawResponseDto, body);
      return this.game.respondDraw(socket.data.user, matchId, accept);
    });
  }
}
