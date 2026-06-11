import { Module } from '@nestjs/common';
import { PseService, PSE_PROVIDER_TOKEN } from './core/providers/pse.service';
import { SunatNativeProvider } from './core/providers/sunat-native.provider';

@Module({
  providers: [
    {
      provide: PSE_PROVIDER_TOKEN,
      useClass: SunatNativeProvider, // Si mañana compras otro, solo cambias esta línea
    },
    PseService,
  ],
  exports: [PseService],
})
export class PseModule {}
