import { HttpException, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Ack, WsError } from './events';

const logger = new Logger('Socket');

/** Validate a socket payload with the same class-validator DTOs used for REST */
export async function parsePayload<T extends object>(dto: new () => T, payload: unknown): Promise<T> {
  const instance = plainToInstance(dto, payload ?? {});
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) {
    const details = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new WsAppError({ code: 'VALIDATION_ERROR', message: 'Validation failed', details });
  }
  return instance;
}

export class WsAppError extends Error {
  constructor(public readonly error: WsError) {
    super(error.message);
  }
}

/** Convert anything thrown by a handler into the ack error envelope */
export function toWsError(e: unknown): WsError {
  if (e instanceof WsAppError) return e.error;
  if (e instanceof HttpException) {
    const r = e.getResponse();
    if (typeof r === 'string') return { code: 'ERROR', message: r };
    const { code, message, details } = r as { code?: string; message?: string | string[]; details?: unknown };
    return {
      code: code ?? 'ERROR',
      message: Array.isArray(message) ? message.join(', ') : (message ?? e.message),
      ...(details !== undefined && { details }),
    };
  }
  logger.error(e instanceof Error ? e.stack : String(e));
  return { code: 'INTERNAL_ERROR', message: 'Something went wrong' };
}

/** Run a handler and always answer with an envelope (never throws back into Socket.IO) */
export async function respond<T>(fn: () => Promise<T>): Promise<Ack<T>> {
  try {
    return { success: true, data: await fn() };
  } catch (e) {
    return { success: false, error: toWsError(e) };
  }
}

/** Minimal Cookie header parser (only needs the auth cookie) */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}
