import { Module } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { InventarioController } from './inventario.controller';
import { PrismaService } from '../../core/database/prisma.service';

@Module({
  controllers: [InventarioController],
  providers: [InventarioService, PrismaService],
  exports: [InventarioService],
})
export class InventarioModule {}
