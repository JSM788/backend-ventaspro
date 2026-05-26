import { Module } from '@nestjs/common';
import { ComprasService } from './compras.service';
import { ComprasController } from './compras.controller';
import { PrismaService } from '../../core/database/prisma.service';
import { InventarioModule } from '../inventario/inventario.module';
import { FinanzasModule } from '../finanzas/finanzas.module';

@Module({
  imports: [InventarioModule, FinanzasModule],
  controllers: [ComprasController],
  providers: [ComprasService, PrismaService],
  exports: [ComprasService],
})
export class ComprasModule {}
