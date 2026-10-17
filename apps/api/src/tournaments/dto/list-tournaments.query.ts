import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { tournamentStatus, type TournamentStatus } from '../../db/schema';

export class ListTournamentsQuery {
  /** Comma-separated, e.g. ?status=open,ongoing */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value,
  )
  @IsIn(tournamentStatus.enumValues, { each: true })
  status?: TournamentStatus[];

  /** Students: only tournaments I've joined (my schedule) */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  joined?: boolean;
}
