import { Module } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { LeaderboardService } from './leaderboard.service';
import { TournamentsService } from './tournaments.service';

@Module({
  controllers: [TournamentsController],
  providers: [TournamentsService, LeaderboardService],
  exports: [TournamentsService, LeaderboardService],
})
export class TournamentsModule {}
