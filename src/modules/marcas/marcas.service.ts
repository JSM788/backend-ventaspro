import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class MarcasService {
  constructor(private prisma: PrismaService) {}

  async create(data: { nombre: string }) {
    let empresa = await this.prisma.empresa.findFirst();
    if (!empresa) throw new BadRequestException('No existe empresa base');

    return this.prisma.marca.create({
      data: {
        nombre: data.nombre,
        empresaId: empresa.id
      }
    });
  }

  async findAll() {
    let empresa = await this.prisma.empresa.findFirst();
    if (!empresa) return [];
    
    return this.prisma.marca.findMany({
      where: { empresaId: empresa.id },
      include: {
        _count: {
          select: { productos: true }
        }
      },
      orderBy: { nombre: 'asc' }
    });
  }

  async remove(id: number) {
    // Check if it's used in any products
    const inUse = await this.prisma.producto.findFirst({ where: { marcaId: id } });
    if (inUse) {
      throw new BadRequestException('No se puede eliminar la marca porque está en uso por uno o más productos.');
    }

    return this.prisma.marca.delete({
      where: { id }
    });
  }
}
