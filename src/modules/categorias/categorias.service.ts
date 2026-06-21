import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  async create(empresaId: string, data: { nombre: string }) {
    return this.prisma.categoria.create({
      data: {
        nombre: data.nombre,
        empresaId
      }
    });
  }

  async findAll(empresaId: string) {
    return this.prisma.categoria.findMany({
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
    const inUse = await this.prisma.producto.findFirst({ where: { categoriaId: id, empresaId } });
    if (inUse) {
      throw new BadRequestException('No se puede eliminar la categoría porque está en uso por uno o más productos.');
    }

    return this.prisma.categoria.deleteMany({
      where: { id, empresaId }
    });
  }
}
