import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  /** GET /api/v1/matches/current — `{ matchId }` of my in-progress game, or `{ matchId: null }` */
  @Get('current')
  async current(@CurrentUser() user: AuthUser) {
    return { matchId: await this.matches.currentMatchId(user.id) };
  }

  /** GET /api/v1/matches/:id — full state incl. FEN, PGN and live clocks (initial load / reconnect) */
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.matches.getView(user, id);
  }
}
