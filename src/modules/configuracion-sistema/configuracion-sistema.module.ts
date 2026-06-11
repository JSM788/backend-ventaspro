import { Module } from '@nestjs/common';
import { ConfiguracionSistemaService } from './configuracion-sistema.service';
import { ConfiguracionSistemaController } from './configuracion-sistema.controller';

@Module({
  controllers: [ConfiguracionSistemaController],
  providers: [ConfiguracionSistemaService],
})
export class ConfiguracionSistemaModule {}
