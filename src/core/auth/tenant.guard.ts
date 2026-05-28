import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class TenantGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    // LLama a la estrategia jwt primero para validar el token
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Si hay error en el token o no hay usuario
    if (err || !user) {
      throw err || new UnauthorizedException('Token inválido o no proporcionado');
    }

    // Aquí aseguramos que el token tiene el tenant (empresaId)
    if (!user.empresaId) {
      throw new UnauthorizedException('El token no contiene el identificador de la compañía (Tenant ID)');
    }

    // Retorna el usuario para inyectarlo en req.user
    return user;
  }
}
