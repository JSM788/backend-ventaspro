import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class NotasVentaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.comprobante.findMany({
      where: { tipo: 'NV' },
      include: { cliente: true },
      orderBy: { fechaEmision: 'desc' },
    });
  }

  async create(data: any) {
    return this.prisma.comprobante.create({
      data: { ...data, tipo: 'NV' },
    });
  }
}
