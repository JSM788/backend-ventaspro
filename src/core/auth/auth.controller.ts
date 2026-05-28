import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Public } from './public.decorator';
import { PrismaService } from '../database/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('dev-login')
  async devLogin(@Body() body: any) {
    // ENTORNO DEV SOLAMENTE: Genera un token válido saltándose nexus-auth
    const empresa = await this.prisma.empresa.findFirst();
    
    if (!empresa) {
      throw new UnauthorizedException('No hay empresas en la BD. Ejecuta el seed primero.');
    }

    const payload = {
      sub: 'dev-user-id',
      email: 'dev@ventaspro.com',
      companyId: empresa.id,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: payload.sub,
        email: payload.email,
        empresaId: empresa.id,
        nombre: 'Usuario Dev',
      }
    };
  }
}
