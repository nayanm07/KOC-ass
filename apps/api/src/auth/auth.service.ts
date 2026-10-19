import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { CookieOptions } from 'express';
import { UsersService, type PublicUser } from '../users/users.service';
import type { AuthUser, JwtPayload } from './auth.types';

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

  /** Used by both the REST guard and the Socket.IO handshake */
  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const p = await this.jwt.verifyAsync<JwtPayload>(token);
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
