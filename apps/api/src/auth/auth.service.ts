import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { CookieOptions } from 'express';
import { UsersService, type PublicUser } from '../users/users.service';
import { SOCKET_TICKET_TTL_SECONDS, type AuthUser, type JwtPayload, type TokenKind } from './auth.types';

// Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered
const DUMMY_HASH = bcrypt.hashSync('timing-attack-dummy', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<{ user: PublicUser; token: string }> {
    const user = await this.users.findByEmail(email);
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const updated = await this.users.touchLastLogin(user.id);
    const payload: JwtPayload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    const token = await this.jwt.signAsync(payload);
    return { user: UsersService.toPublic(updated), token };
  }

  /**
   * Short-lived ticket for the Socket.IO handshake. Fetched through the same-origin proxy (where the
   * httpOnly cookie is sent), so the socket can authenticate even when the API is on another domain.
   */
  async socketTicket(user: AuthUser): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      typ: 'ws',
    };
    return this.jwt.signAsync(payload, { expiresIn: SOCKET_TICKET_TTL_SECONDS });
  }

  /** Used by both the REST guard (session cookie) and the Socket.IO handshake (cookie or ticket) */
  async verifyToken(token: string, kind: TokenKind = 'session'): Promise<AuthUser> {
    try {
      const p = await this.jwt.verifyAsync<JwtPayload>(token);
      // A socket ticket must never work as a REST session, and vice versa
      if ((p.typ ?? 'session') !== kind) throw new Error('wrong token kind');
      return { id: p.sub, email: p.email, name: p.name, role: p.role };
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Session expired, please log in again',
      });
    }
  }

  cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      path: '/',
      maxAge: this.config.getOrThrow<number>('JWT_TTL_SECONDS') * 1000,
    };
  }
}
