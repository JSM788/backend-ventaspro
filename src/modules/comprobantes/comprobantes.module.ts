import { Module } from '@nestjs/common';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesController } from './comprobantes.controller';

@Module({
  controllers: [ComprobantesController],
  providers: [ComprobantesService],
})
export class ComprobantesModule {}
