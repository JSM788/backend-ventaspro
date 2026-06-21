import { Module } from '@nestjs/common';
import { DevolucionesProveedorService } from './devoluciones-proveedor.service';
import { DevolucionesProveedorController } from './devoluciones-proveedor.controller';

@Module({
  controllers: [DevolucionesProveedorController],
  providers: [DevolucionesProveedorService],
  exports: [DevolucionesProveedorService],
})
export class DevolucionesProveedorModule {}
