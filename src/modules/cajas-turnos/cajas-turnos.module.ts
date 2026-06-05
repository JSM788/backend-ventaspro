import { Module } from '@nestjs/common';
import { CajasTurnosController } from './cajas-turnos.controller';
import { CajasTurnosService } from './cajas-turnos.service';

@Module({
  controllers: [CajasTurnosController],
  providers: [CajasTurnosService]
})
export class CajasTurnosModule {}
