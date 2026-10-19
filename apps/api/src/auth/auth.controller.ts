import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { AUTH_COOKIE, type AuthUser } from './auth.types';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/v1/auth/login — sets the httpOnly JWT cookie */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.login(dto.email, dto.password);
    res.cookie(AUTH_COOKIE, token, this.auth.cookieOptions());
    return { user };
  }

  /** POST /api/v1/auth/logout — public so an expired session can still clear its cookie */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    const { maxAge: _maxAge, ...opts } = this.auth.cookieOptions();
    res.clearCookie(AUTH_COOKIE, opts);
    return { loggedOut: true };
  }
}

@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  /** GET /api/v1/me — the current user, read fresh from the DB */
  @Get()
  async me(@CurrentUser() authUser: AuthUser) {
    const user = await this.users.findById(authUser.id);
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Account no longer exists' });
    return { user: UsersService.toPublic(user) };
  }
}
