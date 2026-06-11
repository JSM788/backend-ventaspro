import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Si ya viene un request ID desde Nginx o el Frontend (ej. x-correlation-id), lo usamos.
    // De lo contrario, generamos uno nuevo.
    const correlationId = req.header('x-correlation-id') || uuidv4();
    
    // Adjuntamos el ID a la cabecera del request y response
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    // Lo guardamos en el contexto local para que el logger o interceptor pueda acceder a él fácilmente
    res.locals.correlationId = correlationId;

    next();
  }
}
