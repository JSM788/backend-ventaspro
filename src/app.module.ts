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
import { FinanzasModule } from './modules/finanzas/finanzas.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { ComprasModule } from './modules/compras/compras.module';
import { AuthModule } from './core/auth/auth.module';

import { CategoriasModule } from './modules/categorias/categorias.module';
import { MarcasModule } from './modules/marcas/marcas.module';

import { APP_GUARD } from '@nestjs/core';
import { TenantGuard } from './core/auth/tenant.guard';
import { CajasTurnosModule } from './modules/cajas-turnos/cajas-turnos.module';

@Module({
  imports: [DatabaseModule, ClientesModule, ComprobantesModule, NotasVentaModule, CotizacionesModule, PedidosModule, EmpresasModule, StorageModule, SeriesModule, ProductosModule, FinanzasModule, InventarioModule, ComprasModule, AuthModule, CategoriasModule, MarcasModule, CajasTurnosModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
  ],
})
export class AppModule {}
