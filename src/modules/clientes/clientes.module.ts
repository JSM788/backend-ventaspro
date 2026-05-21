import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { TiposClienteService } from './tipos-cliente.service';
import { TiposClienteController } from './tipos-cliente.controller';

@Module({
  controllers: [ClientesController, TiposClienteController],
  providers: [ClientesService, TiposClienteService],
})
export class ClientesModule {}
