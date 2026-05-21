import { Controller, Get, Post, Body } from '@nestjs/common';
import { PedidosService } from './pedidos.service';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Get()
  findAll() {
    return this.pedidosService.findAll();
  }

  @Post()
  create(@Body() data: any) {
    return this.pedidosService.create(data);
  }
}
