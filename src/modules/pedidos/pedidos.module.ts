import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { PrismaService } from '../../core/database/prisma.service';

@Module({
  controllers: [PedidosController],
  providers: [PedidosService, PrismaService],
})
export class PedidosModule {}
