import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class MarcasService {
  constructor(private prisma: PrismaService) {}

  async create(empresaId: string, data: { nombre: string }) {
    return this.prisma.marca.create({
      data: {
        nombre: data.nombre,
        empresaId
      }
    });
  }

  async findAll(empresaId: string) {
    return this.prisma.marca.findMany({
      where: { empresaId },
      include: {
        _count: {
          select: { productos: true }
        }
      },
      orderBy: { nombre: 'asc' }
    });
  }

  async remove(empresaId: string, id: number) {
    // Check if it's used in any products
    const inUse = await this.prisma.producto.findFirst({ where: { marcaId: id, empresaId } });
    if (inUse) {
      throw new BadRequestException('No se puede eliminar la marca porque está en uso por uno o más productos.');
    }

    return this.prisma.marca.deleteMany({
      where: { id, empresaId }
    });
  }
}
