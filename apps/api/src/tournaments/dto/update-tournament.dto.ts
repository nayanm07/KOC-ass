import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** All fields optional; status changes go through PATCH /:id/status instead */
export class UpdateTournamentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(3, 120, { message: 'Name must be 3–120 characters' })
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(180)
  baseMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  incrementSeconds?: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string;

  @IsOptional()
  @IsIn(['arena', 'round_robin'])
  format?: 'arena' | 'round_robin';
}
