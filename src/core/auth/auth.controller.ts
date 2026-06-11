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
  @Post('login')
  async login(@Body() body: any) {
    const { email, password } = body;

    const user = await this.prisma.usuarioErp.findFirst({
      where: { email }
    });

    if (!user || user.password !== password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      empresaId: user.empresaId,
      isSuperAdmin: user.isSuperAdmin,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: payload.sub,
        email: payload.email,
        empresaId: user.empresaId,
        isSuperAdmin: user.isSuperAdmin,
      }
    };
  }
}
