import { IsUUID } from 'class-validator';

export class QueueJoinDto {
  @IsUUID('4', { message: 'tournamentId must be a valid id' })
  tournamentId!: string;
}
