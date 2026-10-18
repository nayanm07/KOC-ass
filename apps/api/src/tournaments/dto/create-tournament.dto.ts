import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTournamentDto {
  @Transform(trim)
  @IsString()
  @Length(3, 120, { message: 'Name must be 3–120 characters' })
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** Time control base, e.g. 5 for "5+0" */
  @IsInt({ message: 'Minutes must be a whole number' })
  @Min(1)
  @Max(180)
  baseMinutes!: number;

  /** Time control increment, e.g. 3 for "5+3" */
  @IsInt()
  @Min(0)
  @Max(180)
  incrementSeconds!: number;

  /** ISO-8601 with offset, e.g. 2026-10-20T18:30:00.000Z — stored as UTC timestamptz */
  @IsISO8601({ strict: true }, { message: 'startsAt must be an ISO-8601 date-time' })
  startsAt!: string;

  /** arena (default): unlimited games, closest-ranked pairing · round_robin: everyone plays everyone once */
  @IsOptional()
  @IsIn(['arena', 'round_robin'])
  format?: 'arena' | 'round_robin';

  /** A coach may publish immediately; defaults to draft */
  @IsOptional()
  @IsIn(['draft', 'open'])
  status?: 'draft' | 'open';
}
