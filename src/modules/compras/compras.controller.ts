import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ComprasService } from './compras.service';

@Controller('v1/compras')
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Get('ordenes')
  async findAll() {
    return await this.comprasService.findAll();
  }

  @Post('ordenes/:id/recibir')
  async recibirOrden(
    @Param('id') id: string,
    @Body('almacenId') almacenId: string
  ) {
    return await this.comprasService.recibirOrden(id, almacenId);
  }
}
