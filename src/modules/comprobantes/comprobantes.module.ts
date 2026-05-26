import { Module } from '@nestjs/common';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesController } from './comprobantes.controller';

import { InventarioModule } from '../inventario/inventario.module';

@Module({
  imports: [InventarioModule],
  controllers: [ComprobantesController],
  providers: [ComprobantesService],
})
export class ComprobantesModule {}
