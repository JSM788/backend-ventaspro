import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    let empresa = await this.prisma.empresa.findFirst();
    if (!empresa) throw new BadRequestException('No existe empresa base');
    
    return this.prisma.producto.findMany({
      where: { empresaId: empresa.id },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(data: any) {
    let empresa = await this.prisma.empresa.findFirst();
    if (!empresa) throw new BadRequestException('No existe empresa base');

    return this.prisma.producto.create({
      data: {
        empresaId: empresa.id,
        tipo: data.tipo || 'PRODUCTO',
        nombre: data.nombre,
        descripcion: data.descripcion,
        unidadMedida: data.unidad || 'NIU',
        precioUnitario: data.precioUnitario ? Number(data.precioUnitario) : 0,
        incluyeIgv: data.incluyeIgv ?? true,
        tipoAfectacion: data.tipoAfectacion || '10',
        stock: data.stockInicial ? Number(data.stockInicial) : 0,
        codigoInterno: data.codigoInterno,
        codigoSunat: data.codigoSunat,
      }
    });
  }

  async updateImageUrl(id: number, url: string) {
    return this.prisma.producto.update({
      where: { id },
      data: { imagenUrl: url }
    });
  }

  async remove(id: number) {
    return this.prisma.producto.delete({
      where: { id }
    });
  }
}
