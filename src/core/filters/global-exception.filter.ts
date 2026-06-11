import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    // Recuperar el Correlation ID del request o res.locals
    const correlationId = response.locals.correlationId || request.headers['x-correlation-id'] || 'N/A';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let errorCode = 'ERR_INTERNAL';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resMsg = exception.getResponse();
      message = typeof resMsg === 'object' && resMsg !== null && 'message' in resMsg ? (resMsg as any).message : resMsg;
      errorCode = typeof resMsg === 'object' && resMsg !== null && 'errorCode' in resMsg ? (resMsg as any).errorCode : `HTTP_${status}`;
    } else {
      // Manejar errores nativos o Prisma aquí
      const err = exception as any;
      if (err?.code && typeof err.code === 'string') {
        if (err.code.startsWith('P')) { // Prisma Error
          errorCode = `PRISMA_${err.code}`;
          message = 'Error en la base de datos';
        }
      }
    }

    // Log estructurado del error
    const logPayload = {
      correlationId,
      path: request.url,
      method: request.method,
      statusCode: status,
      errorCode,
      user: request.user ? (request.user as any).id : 'anonymous',
      body: this.sanitizeBody(request.body),
      message,
    };

    if (status >= 500) {
      this.logger.error(`[${correlationId}] ${request.method} ${request.url} - ${status}`, {
        ...logPayload,
        stack: exception instanceof Error ? exception.stack : String(exception),
      });
    } else {
      // Para errores 4xx (Bad Request, Unauthorized, etc) usar warn y no escupir todo el stack trace
      this.logger.warn(`[${correlationId}] ${request.method} ${request.url} - ${status} - ${message}`, logPayload);
    }

    response.status(status).json({
      success: false,
      errorCode,
      message,
      correlationId,
    });
  }

  // Método para ocultar contraseñas o tokens antes de loguear
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;
    const sanitized = { ...body };
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.token) sanitized.token = '***';
    return sanitized;
  }
}
