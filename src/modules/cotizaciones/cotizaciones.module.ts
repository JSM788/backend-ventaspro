import { Module } from '@nestjs/common';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesService } from './cotizaciones.service';
import { PrismaService } from '../../core/database/prisma.service';

@Module({
  controllers: [CotizacionesController],
  providers: [CotizacionesService, PrismaService],
})
export class CotizacionesModule {}
