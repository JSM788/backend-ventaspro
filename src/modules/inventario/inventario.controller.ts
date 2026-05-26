import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { InventarioService, RegistrarMovimientoDto } from './inventario.service';

@Controller('v1/inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Post('movimiento')
  async registrarMovimiento(@Body() data: RegistrarMovimientoDto) {
    return await this.inventarioService.registrarMovimiento(data);
  }

  @Get('stock/:productoId')
  async obtenerStock(
    @Param('productoId') productoId: string,
    @Query('almacenId') almacenId?: string
  ) {
    const stock = await this.inventarioService.obtenerStock(Number(productoId), almacenId);
    return { stock };
  }

  @Get('kardex/resumen')
  async obtenerResumenKardex() {
    return await this.inventarioService.obtenerResumenKardex();
  }

  @Get('kardex/:productoId')
  async obtenerKardex(
    @Param('productoId') productoId: string,
    @Query('almacenId') almacenId?: string
  ) {
    const historial = await this.inventarioService.obtenerKardex(Number(productoId), almacenId);
    return { historial };
  }
}
