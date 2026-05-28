import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Extrae el token del header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Usamos un secret predeterminado en dev, pero en prod vendrá del .env
      secretOrKey: process.env.JWT_SECRET || 'nexus-auth-super-secret-key', 
    });
  }

  async validate(payload: any) {
    // Aquí el payload ya pasó la validación de firma
    // Mapeamos el 'companyId' que inyecta nexus-auth a nuestro 'empresaId'
    return { 
      userId: payload.sub, 
      email: payload.email, 
      empresaId: payload.companyId || payload.empresaId 
    };
  }
}
