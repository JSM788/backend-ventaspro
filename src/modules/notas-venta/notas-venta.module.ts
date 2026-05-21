import { Module } from '@nestjs/common';
import { NotasVentaController } from './notas-venta.controller';
import { NotasVentaService } from './notas-venta.service';
import { PrismaService } from '../../core/database/prisma.service';

@Module({
  controllers: [NotasVentaController],
  providers: [NotasVentaService, PrismaService],
})
export class NotasVentaModule {}
