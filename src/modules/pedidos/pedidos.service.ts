import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class PedidosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.pedido.findMany({
      include: { cliente: true },
      orderBy: { fechaEmision: 'desc' },
    });
  }

  async create(data: any) {
    return this.prisma.pedido.create({
      data,
    });
  }
}
