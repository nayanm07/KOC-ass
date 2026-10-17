import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { ListTournamentsQuery } from './dto/list-tournaments.query';
import { UpdateTournamentStatusDto } from './dto/update-status.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentsService } from './tournaments.service';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  /** GET /api/v1/tournaments?status=open,ongoing&joined=true — students never see drafts */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTournamentsQuery) {
    return this.tournaments.list(user, query);
  }

  /** GET /api/v1/tournaments/:id — includes participants */
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.tournaments.findOne(user, id);
  }

  /** GET /api/v1/tournaments/:id/leaderboard — standings, winner/leader, stats */
  @Get(':id/leaderboard')
  leaderboard(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.tournaments.leaderboard(user, id);
  }

  /** GET /api/v1/tournaments/:id/matches — per-match results (live first) */
  @Get(':id/matches')
  matches(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.tournaments.matches(user, id);
  }

  /* ── Coach ── */

  @Roles('coach')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTournamentDto) {
    return this.tournaments.create(user, dto);
  }

  @Roles('coach')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body() dto: UpdateTournamentDto) {
    return this.tournaments.update(user, id, dto);
  }

  @Roles('coach')
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateTournamentStatusDto,
  ) {
    return this.tournaments.updateStatus(user, id, dto.status);
  }

  @Roles('coach')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', uuid) id: string) {
    return this.tournaments.remove(id);
  }

  /* ── Student ── */

  @Roles('student')
  @Post(':id/join')
  join(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.tournaments.join(user, id);
  }

  @Roles('student')
  @Delete(':id/join')
  @HttpCode(HttpStatus.OK)
  leave(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.tournaments.leave(user, id);
  }
}
