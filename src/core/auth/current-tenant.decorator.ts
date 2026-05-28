import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // extraído por jwt.strategy.ts y validado por tenant.guard.ts
    return request.user?.empresaId; 
  },
);
