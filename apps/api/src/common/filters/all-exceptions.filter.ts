import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/** Every failed REST response: `{ success: false, error: { statusCode, code, message, details? }, path, timestamp }` */
export interface ErrorEnvelope {
  success: false;
  error: { statusCode: number; code: string; message: string; details?: unknown };
  path: string;
  timestamp: string;
}

/** Postgres error codes we translate into client errors instead of 500s */
const PG_ERRORS: Record<string, { status: HttpStatus; code: string; message: string }> = {
  '23505': { status: HttpStatus.CONFLICT, code: 'CONFLICT', message: 'Resource already exists' },
  '23503': {
    status: HttpStatus.CONFLICT,
    code: 'FOREIGN_KEY_VIOLATION',
    message: 'Related resource is missing or still in use',
  },
  '23514': { status: HttpStatus.BAD_REQUEST, code: 'CHECK_VIOLATION', message: 'Value violates a data rule' },
  '22P02': { status: HttpStatus.BAD_REQUEST, code: 'INVALID_INPUT', message: 'Invalid input syntax' },
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;

    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const error = this.toError(exception);

    if (error.statusCode >= 500) {
      this.logger.error(`${req.method} ${req.url}`, exception instanceof Error ? exception.stack : exception);
    }

    const body: ErrorEnvelope = {
      success: false,
      error,
      path: req.url,
      timestamp: new Date().toISOString(),
    };
    res.status(error.statusCode).json(body);
  }

  private toError(exception: unknown): ErrorEnvelope['error'] {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const fallbackCode = HttpStatus[statusCode] ?? 'ERROR';

      if (typeof response === 'string') {
        return { statusCode, code: fallbackCode, message: response };
      }
      const r = response as { message?: string | string[]; code?: string; details?: unknown };
      // ValidationPipe returns `message: string[]` — surface them as details
      if (Array.isArray(r.message)) {
        return { statusCode, code: 'VALIDATION_ERROR', message: 'Validation failed', details: r.message };
      }
      return {
        statusCode,
        code: r.code ?? fallbackCode,
        message: r.message ?? exception.message,
        ...(r.details !== undefined && { details: r.details }),
      };
    }

    // Drizzle wraps driver errors; the pg error (with its SQLSTATE code) is on `cause`
    const pgCode = this.pgErrorCode(exception);
    if (pgCode && PG_ERRORS[pgCode]) {
      const { status, code, message } = PG_ERRORS[pgCode];
      return { statusCode: status, code, message };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong',
    };
  }

  private pgErrorCode(e: unknown): string | undefined {
    const err = e as { code?: unknown; cause?: { code?: unknown } } | null;
    const code = err?.cause?.code ?? err?.code;
    return typeof code === 'string' ? code : undefined;
  }
}
