import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';
import type { UsersService } from '../users/users.service';

const user: AuthUser = { id: 'u1', email: 'aarav@koc.test', name: 'Aarav', role: 'student' };
const jwt = new JwtService({ secret: 'test-secret-at-least-16', signOptions: { expiresIn: 3600 } });
const auth = new AuthService({} as UsersService, jwt, new ConfigService());

describe('AuthService tokens', () => {
  it('a socket ticket opens a socket', async () => {
    const ticket = await auth.socketTicket(user);
    await expect(auth.verifyToken(ticket, 'ws')).resolves.toEqual(user);
  });

  it('a socket ticket is NOT accepted as a REST session', async () => {
    const ticket = await auth.socketTicket(user);
    await expect(auth.verifyToken(ticket)).rejects.toMatchObject({ response: { code: 'INVALID_TOKEN' } });
  });

  it('a session token is NOT accepted where a ticket is required', async () => {
    const session = await jwt.signAsync({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await expect(auth.verifyToken(session)).resolves.toEqual(user);
    await expect(auth.verifyToken(session, 'ws')).rejects.toMatchObject({
      response: { code: 'INVALID_TOKEN' },
    });
  });

  it('a ticket expires after 60 seconds', async () => {
    const ticket = await auth.socketTicket(user);
    const { exp, iat } = jwt.decode<{ exp: number; iat: number }>(ticket);
    expect(exp - iat).toBe(60);
  });
});
