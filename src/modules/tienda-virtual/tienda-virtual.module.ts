import { Module } from '@nestjs/common';
import { TiendaVirtualController } from './tienda-virtual.controller';
import { TiendaVirtualService } from './tienda-virtual.service';
import { AdminTiendaConfiguracionController } from './admin-tienda-configuracion.controller';
import { AdminTiendaConfiguracionService } from './admin-tienda-configuracion.service';
import { DatabaseModule } from '../../core/database/database.module';
import { StorageModule } from '../../core/storage/storage.module';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [TiendaVirtualController, AdminTiendaConfiguracionController],
  providers: [TiendaVirtualService, AdminTiendaConfiguracionService]
})
export class TiendaVirtualModule {}
