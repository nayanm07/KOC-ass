import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MatchesModule } from '../matches/matches.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { PlayGateway } from './play.gateway';

@Module({
  imports: [AuthModule, MatchmakingModule, MatchesModule],
  providers: [PlayGateway],
})
export class PlayModule {}
