import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { StorageService } from '../../core/storage/storage.interface';

@Injectable()
export class EmpresasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getConfig() {
    // Para entornos multitenant reales, aquí se filtra por el tenantId del usuario (req.user)
    // Usaremos findFirst porque por ahora hay una sola empresa semilla
    let empresa = await this.prisma.empresa.findFirst();
    if (!empresa) {
      empresa = await this.prisma.empresa.create({
        data: {
          ruc: '20123456789',
          razonSocial: 'EMPRESA DE PRUEBA SAC',
        },
      });
    }
    return empresa;
  }

  async updateConfig(data: any) {
    const empresa = await this.getConfig();
    return this.prisma.empresa.update({
      where: { id: empresa.id },
      data: {
        ruc: data.ruc,
        razonSocial: data.razonSocial,
      },
    });
  }

  /**
   * Sube un logo de empresa al StorageService.
   * @param tipo 'claro' | 'oscuro'
   * @param file Archivo recibido por Multer (FileInterceptor)
   */
  async uploadLogo(tipo: 'claro' | 'oscuro', file: Express.Multer.File) {
    const empresa = await this.getConfig();

    // Eliminar logo anterior si existe (para no acumular archivos huérfanos)
    const pathActual = tipo === 'claro' ? empresa.logoClaro : empresa.logoOscuro;
    if (pathActual) {
      await this.storage.delete(pathActual);
    }

    // Subir el nuevo logo al proveedor activo
    const result = await this.storage.upload(
      'empresas',
      empresa.id,
      `logo-${tipo}`,
      file.buffer,
      file.mimetype,
    );

    // Guardar el path relativo en BD (no la URL, para que sea agnóstico al proveedor)
    const updateData =
      tipo === 'claro'
        ? { logoClaro: result.path }
        : { logoOscuro: result.path };

    await this.prisma.empresa.update({
      where: { id: empresa.id },
      data: updateData,
    });

    return { url: result.url, path: result.path };
  }

  async updateCertificado(file: Express.Multer.File | undefined, data: any) {
    const empresa = await this.getConfig();
    const updateData: any = {};

    if (file) {
      updateData.certificadoBase64 = file.buffer.toString('base64');
    }
    
    if (data.certificadoPassword !== undefined) {
      updateData.certificadoPassword = data.certificadoPassword;
    }
    
    if (data.sunatUsuario !== undefined) {
      updateData.sunatUsuario = data.sunatUsuario;
    }
    
    if (data.sunatClave !== undefined) {
      updateData.sunatClave = data.sunatClave;
    }

    await this.prisma.empresa.update({
      where: { id: empresa.id },
      data: updateData,
    });

    return { success: true };
  }
}
