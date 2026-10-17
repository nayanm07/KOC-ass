import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Matches, Min } from 'class-validator';

const SQUARE = /^[a-h][1-8]$/;

export class MatchRefDto {
  @IsUUID('4', { message: 'matchId must be a valid id' })
  matchId!: string;
}

export class MoveDto extends MatchRefDto {
  @Matches(SQUARE, { message: 'from must be a square like e2' })
  from!: string;

  @Matches(SQUARE, { message: 'to must be a square like e4' })
  to!: string;

  @IsOptional()
  @IsIn(['q', 'r', 'b', 'n'])
  promotion?: 'q' | 'r' | 'b' | 'n';

  /** The ply the client's board is at — stale clients are rejected and resynced */
  @IsOptional()
  @IsInt()
  @Min(0)
  ply?: number;
}

export class DrawResponseDto extends MatchRefDto {
  @IsBoolean()
  accept!: boolean;
}
