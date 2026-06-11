import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const request = req as any;
    // Si ya existe en el token JWT, lo usamos
    if (request.user?.empresaId) {
      return next();
    }

    // Ya no asignamos una empresa por defecto en desarrollo.
    // El TenantGuard se encargará de validar el JWT.

    next();
  }
}
