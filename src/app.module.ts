import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './core/database/database.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ComprobantesModule } from './modules/comprobantes/comprobantes.module';
import { NotasVentaModule } from './modules/notas-venta/notas-venta.module';
import { CotizacionesModule } from './modules/cotizaciones/cotizaciones.module';
import { PedidosModule } from './modules/pedidos/pedidos.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { StorageModule } from './core/storage/storage.module';
import { SeriesModule } from './modules/series/series.module';
import { ProductosModule } from './modules/productos/productos.module';

@Module({
  imports: [DatabaseModule, ClientesModule, ComprobantesModule, NotasVentaModule, CotizacionesModule, PedidosModule, EmpresasModule, StorageModule, SeriesModule, ProductosModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
