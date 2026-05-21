import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.cliente.findMany({
      include: { tipoCliente: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: number) {
    return this.prisma.cliente.findUnique({
      where: { id },
      include: { tipoCliente: true },
    });
  }

  async create(data: any) {
    return this.prisma.cliente.create({
      data,
    });
  }

  async update(id: number, data: any) {
    return this.prisma.cliente.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    return this.prisma.cliente.delete({
      where: { id },
    });
  }
}
