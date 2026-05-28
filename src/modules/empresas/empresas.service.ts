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
    return this.prisma.empresa.findFirst();
  }

  async createConfig(data: any) {
    const existing = await this.getConfig();
    if (existing) {
      throw new Error('La empresa ya está configurada. Usa PUT para actualizar.');
    }

    // Generar un slug básico a partir de la razón social
    const slug = data.razonSocial
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    return this.prisma.empresa.create({
      data: {
        ruc: data.ruc,
        razonSocial: data.razonSocial,
        slug: slug || 'empresa',
      },
    });
  }

  async updateConfig(data: any) {
    const empresa = await this.getConfig();
    if (!empresa) {
      throw new Error('No hay empresa configurada. Usa POST para crearla primero.');
    }
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
    if (!empresa) {
      throw new Error('No hay empresa configurada para subir un logo.');
    }

    // Eliminar logo anterior si existe (para no acumular archivos huérfanos)
    const pathActual = tipo === 'claro' ? empresa.logoClaro : empresa.logoOscuro;
    if (pathActual) {
      await this.storage.delete(pathActual);
    }

    // Subir el nuevo logo al proveedor activo
    const tenantKey = `${empresa.slug}-${empresa.id.substring(0, 8)}`;
    const result = await this.storage.upload(
      'public',
      tenantKey,
      'config', // Módulo
      file.originalname,
      file.buffer,
      file.mimetype,
      false
    );

    // Guardar la URL resultante en la BD
    await this.prisma.empresa.update({
      where: { id: empresa.id },
      data: {
        ...(tipo === 'claro' ? { logoClaro: result.path } : { logoOscuro: result.path }),
      },
    });

    return { url: result.url };
  }

  /**
   * Sube el certificado digital y lo encripta
   */
  async updateCertificado(file: Express.Multer.File | undefined, data: any) {
    const empresa = await this.getConfig();
    if (!empresa) {
      throw new Error('No hay empresa configurada para subir el certificado.');
    }
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
