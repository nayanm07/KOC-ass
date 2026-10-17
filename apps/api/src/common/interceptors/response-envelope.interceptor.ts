import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

/** Every successful REST response: `{ success: true, data }` */
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessEnvelope<T>> {
    // Only wrap HTTP responses; WebSocket handlers have their own event payloads
    if (context.getType() !== 'http') return next.handle() as Observable<SuccessEnvelope<T>>;
    return next.handle().pipe(map((data) => ({ success: true, data: data ?? (null as T) })));
  }
}
