import { Module } from '@nestjs/common';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesController } from './comprobantes.controller';

import { InventarioModule } from '../inventario/inventario.module';
import { PseModule } from '../../pse/pse.module';

@Module({
  imports: [InventarioModule, PseModule],
  controllers: [ComprobantesController],
  providers: [ComprobantesService],
})
export class ComprobantesModule {}
