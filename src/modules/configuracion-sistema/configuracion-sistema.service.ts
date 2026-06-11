import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ConfiguracionSistemaService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfiguracion() {
    let config = await this.prisma.configuracionSistema.findUnique({
      where: { id: 'GLOBAL' },
    });

    if (!config) {
      config = await this.prisma.configuracionSistema.create({
        data: { id: 'GLOBAL' },
      });
    }

    // Excluir la contraseña al devolver al frontend
    const { certificadoPassword, ...publicConfig } = config;
    return publicConfig;
  }

  async updateConfiguracion(data: any) {
    const updateData: any = {};
    if (data.sunatUsuario !== undefined) updateData.sunatUsuario = data.sunatUsuario;
    if (data.sunatClave !== undefined) updateData.sunatClave = data.sunatClave;

    return this.prisma.configuracionSistema.upsert({
      where: { id: 'GLOBAL' },
      update: updateData,
      create: { id: 'GLOBAL', ...updateData },
    });
  }

  async updateCertificado(file: Express.Multer.File | undefined, data: any) {
    const updateData: any = {};

    if (file) {
      updateData.certificadoBase64 = file.buffer.toString('base64');
    }

    if (data.certificadoPassword !== undefined) {
      updateData.certificadoPassword = data.certificadoPassword;
    }

    if (data.sunatUsuario !== undefined) updateData.sunatUsuario = data.sunatUsuario;
    if (data.sunatClave !== undefined) updateData.sunatClave = data.sunatClave;

    await this.prisma.configuracionSistema.upsert({
      where: { id: 'GLOBAL' },
      update: updateData,
      create: { id: 'GLOBAL', ...updateData },
    });

    return { success: true };
  }
}
