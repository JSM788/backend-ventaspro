import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    
    // Si es SuperAdmin y está simulando una empresa (viene en el header)
    const impersonatedId = request.headers['x-empresa-id'];
    if (request.user?.isSuperAdmin && impersonatedId) {
      return impersonatedId;
    }

    // extraído por jwt.strategy.ts y validado por tenant.guard.ts
    return request.user?.empresaId; 
  },
);
