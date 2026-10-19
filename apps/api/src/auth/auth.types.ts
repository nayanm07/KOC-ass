import type { UserRole } from '../db/schema';

export const AUTH_COOKIE = 'access_token';

/** `session` = the login cookie; `ws` = a short-lived ticket that only opens a socket */
export type TokenKind = 'session' | 'ws';

/** Claims stored in the JWT */
export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  /** Absent on session tokens */
  typ?: 'ws';
}

/** Socket tickets only need to survive the handshake */
export const SOCKET_TICKET_TTL_SECONDS = 60;

/** What guards attach to `request.user` / `socket.data.user` */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
