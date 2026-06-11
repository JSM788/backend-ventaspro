import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

export interface StandardResponse<T> {
  success: boolean;
  data: T;
  correlationId?: string;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, StandardResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<StandardResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const correlationId = response.locals.correlationId;

    return next.handle().pipe(
      map(data => {
        // Evitar doble envoltorio si el controlador ya devolvió el formato estándar a mano
        if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
          return {
            ...data,
            correlationId,
          };
        }

        return {
          success: true,
          data,
          correlationId,
        };
      }),
    );
  }
}
