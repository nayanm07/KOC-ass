import { Module } from '@nestjs/common';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { DrawOffers } from './draw-offers';
import { GameService } from './game.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [TournamentsModule],
  controllers: [MatchesController],
  providers: [MatchesService, GameService, DrawOffers],
  exports: [MatchesService, GameService],
})
export class MatchesModule {}
