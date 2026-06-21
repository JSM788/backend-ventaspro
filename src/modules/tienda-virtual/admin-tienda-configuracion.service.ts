import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { StorageService } from '../../core/storage/storage.interface';

@Injectable()
export class AdminTiendaConfiguracionService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService
  ) {}

  async getConfiguracion(empresaId: string) {
    if (!empresaId) {
      throw new Error('Empresa no definida');
    }

    let config: any = await this.prisma.tiendaConfiguracion.findUnique({
      where: { empresaId },
      include: { empresa: { select: { slug: true, razonSocial: true } } }
    });

    if (!config) {
      config = await this.prisma.tiendaConfiguracion.create({
        data: {
          empresaId,
          colorPrimario: '#2D2491'
        },
        include: { empresa: { select: { slug: true, razonSocial: true } } }
      });
    }

    return config;
  }

  async updateConfiguracion(empresaId: string, data: any) {
    const config = await this.getConfiguracion(empresaId);
    
    return this.prisma.tiendaConfiguracion.update({
      where: { id: config.id },
      data: {
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : config.logoUrl,
        bannerUrl: data.bannerUrl !== undefined ? data.bannerUrl : config.bannerUrl,
        colorPrimario: data.colorPrimario !== undefined ? data.colorPrimario : config.colorPrimario,
        whatsapp: data.whatsapp !== undefined ? data.whatsapp : config.whatsapp,
      },
      include: { empresa: { select: { slug: true, razonSocial: true } } }
    });
  }

  async uploadImage(tipo: 'logo' | 'banner', file: Express.Multer.File, reqEmpresaId: string) {
    const config = await this.getConfiguracion(reqEmpresaId);
    const empresaId = config.empresaId;
    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId } });

    if (!empresa) {
      throw new Error('Empresa no encontrada.');
    }

    // Eliminar imagen anterior si existe
    const pathActual = tipo === 'logo' ? config.logoUrl : config.bannerUrl;
    if (pathActual && pathActual.includes('http')) {
      // Extraemos la ruta relativa para borrar si es de nuestro bucket. 
      // Si usas CDN o Cloudflare, el path de eliminación puede requerir extraer el pathname final.
      // Por simplicidad en StorageService.delete, asumimos que se le pasa la ruta o se encarga.
      try { await this.storage.delete(pathActual); } catch (e) {}
    }

    const tenantKey = `${empresa.slug}-${empresa.id.substring(0, 8)}`;
    const result = await this.storage.upload(
      'public',
      tenantKey,
      'tienda', // Modulo "tienda"
      `${tipo}_${Date.now()}_${file.originalname}`,
      file.buffer,
      file.mimetype,
      false
    );

    // Actualizar configuración
    await this.prisma.tiendaConfiguracion.update({
      where: { id: config.id },
      data: {
        ...(tipo === 'logo' ? { logoUrl: result.url } : { bannerUrl: result.url }),
      },
    });

    return { url: result.url };
  }

  async getPedidosTienda(empresaId: string, query: any = {}) {
    if (!empresaId) throw new Error('Empresa no definida');
    
    const { search, fechaInicio, fechaFin, estado, serie } = query;

    let whereObj: any = {
      empresaId,
      transaccionId: { startsWith: 'B2C-' }
    };

    if (search) {
      whereObj.OR = [
        { cliente: { razonSocial: { contains: search, mode: 'insensitive' } } },
        { cliente: { ruc: { contains: search, mode: 'insensitive' } } },
        { transaccionId: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (fechaInicio && fechaFin) {
      whereObj.fechaEmision = {
        gte: new Date(fechaInicio),
        lte: new Date(fechaFin)
      };
    }

    if (estado && estado !== 'Todos') {
      whereObj.estadoPago = estado;
    }

    if (serie && serie !== 'Todas') {
      whereObj.serie = serie;
    }

    const pedidos = await this.prisma.comprobante.findMany({
      where: whereObj,
      include: {
        cliente: {
          select: { razonSocial: true, ruc: true, email: true }
        },
        detalles: {
          select: { cantidad: true, descripcion: true, total: true }
        }
      },
      orderBy: { fechaEmision: 'desc' }
    });

    return { success: true, data: pedidos };
  }
}
