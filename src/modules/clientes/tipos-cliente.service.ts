import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class TiposClienteService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tipoCliente.findMany({
      orderBy: { nombre: 'asc' }
    });
  }

  async create(data: any) {
    return this.prisma.tipoCliente.create({
      data,
    });
  }

  async remove(id: number) {
    return this.prisma.tipoCliente.delete({
      where: { id },
    });
  }
}
