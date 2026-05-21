import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class SeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    // Por ahora usamos la empresa de prueba (multitenant futuro)
    const empresa = await this.prisma.empresa.findFirst();
    if (!empresa) throw new BadRequestException('Empresa no encontrada');

    return this.prisma.serieConfig.findMany({
      where: { empresaId: empresa.id },
      orderBy: { serie: 'asc' },
    });
  }

  async create(data: { tipoComprobante: string; serie: string; correlativoInicio: number }) {
    const empresa = await this.prisma.empresa.findFirst();
    if (!empresa) throw new BadRequestException('Empresa no encontrada');

    // Validar si la serie ya existe para esta empresa
    const existe = await this.prisma.serieConfig.findFirst({
      where: { empresaId: empresa.id, serie: data.serie },
    });

    if (existe) {
      throw new BadRequestException('Esta serie ya existe');
    }

    // La matemática clave: si el usuario quiere que la siguiente factura sea la 100,
    // nosotros guardamos el ultimoCorrelativo como 99.
    const ultimoCorrelativo = Math.max(0, data.correlativoInicio - 1);

    return this.prisma.serieConfig.create({
      data: {
        empresaId: empresa.id,
        tipoComprobante: data.tipoComprobante,
        serie: data.serie,
        ultimoCorrelativo,
        estado: 'ACTIVO',
      },
    });
  }

  async remove(id: number) {
    // Validar si la serie ya tiene comprobantes emitidos.
    // Como las series están atadas indirectamente a los comprobantes por el string "serie",
    // verificamos si hay algún comprobante con esta serie.
    const serieConfig = await this.prisma.serieConfig.findUnique({ where: { id } });
    if (!serieConfig) throw new BadRequestException('Serie no encontrada');

    const comprobantesEmitidos = await this.prisma.comprobante.findFirst({
      where: {
        empresaId: serieConfig.empresaId,
        serie: serieConfig.serie,
      },
    });

    if (comprobantesEmitidos) {
      // En vez de eliminarla, podríamos solo "desactivarla" (Soft Delete)
      throw new BadRequestException('No se puede eliminar una serie que ya tiene facturas emitidas.');
    }

    return this.prisma.serieConfig.delete({
      where: { id },
    });
  }
}
