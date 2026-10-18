import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Max, Min, MinLength, validateSync } from 'class-validator';

/** Validated + typed environment. The app refuses to boot if this fails. */
export class EnvironmentVariables {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(16, { message: 'JWT_SECRET must be at least 16 characters' })
  JWT_SECRET!: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  JWT_TTL_SECONDS: number = 60 * 60 * 24 * 7;

  @IsUrl({ require_tld: false })
  WEB_ORIGIN!: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  COOKIE_SECURE: string = 'false';

  /** Matchmaking pool window: players queueing within it are paired together by standings */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30000)
  PAIRING_WINDOW_MS: number = 1500;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    const details = errors.map((e) => `  - ${Object.values(e.constraints ?? {}).join(', ')}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return env;
}
