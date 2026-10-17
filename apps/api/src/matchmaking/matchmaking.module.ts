import { Module } from '@nestjs/common';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { MatchmakingService } from './matchmaking.service';

@Module({
  imports: [TournamentsModule],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
