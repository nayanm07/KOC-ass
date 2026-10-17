import type { UserRole } from '../db/schema';

export const AUTH_COOKIE = 'access_token';

/** Claims stored in the JWT */
export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
}

/** What guards attach to `request.user` / `socket.data.user` */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
