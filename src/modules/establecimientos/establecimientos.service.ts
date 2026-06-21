import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class EstablecimientosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(empresaId: string) {
    return this.prisma.almacen.findMany({
      where: { empresaId },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(empresaId: string, id: string) {
    const establecimiento = await this.prisma.almacen.findFirst({
      where: { id, empresaId },
    });
    if (!establecimiento) {
      throw new NotFoundException(`Establecimiento no encontrado`);
    }
    return establecimiento;
  }

  async create(empresaId: string, data: any) {
    return this.prisma.almacen.create({
      data: {
        empresaId,
        nombre: data.nombre,
        codigoSunat: data.codigoSunat,
        telefono: data.telefono,
        correo: data.email,
        direccion: data.direccion || data.direccionFisica,
        esPrincipal: false,
        estado: data.estado || 'ACTIVO',
      },
    });
  }

  async update(empresaId: string, id: string, data: any) {
    const existe = await this.prisma.almacen.findFirst({ where: { id, empresaId } });
    if (!existe) throw new NotFoundException(`Establecimiento no encontrado`);

    return this.prisma.almacen.update({
      where: { id },
      data: {
        nombre: data.nombre,
        codigoSunat: data.codigoSunat,
        telefono: data.telefono,
        correo: data.email,
        direccion: data.direccion || data.direccionFisica,
        estado: data.estado,
      },
    });
  }

  async remove(empresaId: string, id: string) {
    const existe = await this.prisma.almacen.findFirst({ where: { id, empresaId } });
    if (!existe) throw new NotFoundException(`Establecimiento no encontrado`);

    return this.prisma.almacen.delete({
      where: { id },
    });
  }
}
