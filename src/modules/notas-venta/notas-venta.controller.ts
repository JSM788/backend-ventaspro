import { Controller, Get, Post, Body } from '@nestjs/common';
import { NotasVentaService } from './notas-venta.service';

@Controller('notas-venta')
export class NotasVentaController {
  constructor(private readonly notasVentaService: NotasVentaService) {}

  @Get()
  findAll() {
    return this.notasVentaService.findAll();
  }

  @Post()
  create(@Body() data: any) {
    return this.notasVentaService.create(data);
  }
}
