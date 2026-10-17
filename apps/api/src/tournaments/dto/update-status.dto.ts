import { IsIn } from 'class-validator';
import { tournamentStatus, type TournamentStatus } from '../../db/schema';

export class UpdateTournamentStatusDto {
  @IsIn(tournamentStatus.enumValues, {
    message: `status must be one of: ${tournamentStatus.enumValues.join(', ')}`,
  })
  status!: TournamentStatus;
}
