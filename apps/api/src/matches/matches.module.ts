import { Module } from '@nestjs/common';
import { DrawOffers } from './draw-offers';
import { GameService } from './game.service';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, GameService, DrawOffers],
  exports: [MatchesService, GameService],
})
export class MatchesModule {}
